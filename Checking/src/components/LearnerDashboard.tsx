import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase,  type Paper } from '../lib/supabase';
import { Upload, FileText, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import Navbar from './Navbar';

export default function LearnerDashboard() {
  const { profile } = useAuth();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [title, setTitle] = useState('');
  const [answerSheet, setAnswerSheet] = useState<File | null>(null);
  const [questionPaper, setQuestionPaper] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);

  useEffect(() => {
    loadPapers();

    const subscription = supabase
      .channel('papers_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'papers',
          filter: `learner_id=eq.${profile?.id}`,
        },
        () => {
          loadPapers();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile]);

  const loadPapers = async () => {
    if (!profile) return;

    const { data } = await supabase
      .from('papers')
      .select('*')
      .eq('learner_id', profile.id)
      .order('created_at', { ascending: false });

    if (data) {
      setPapers(data);
    }
  };

  const uploadFile = async (file: File, path: string) => {
    const { data, error } = await supabase.storage
      .from('papers')
      .upload(path, file, { upsert: true });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('papers')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerSheet || !profile) return;

    setUploading(true);
    try {
      const timestamp = Date.now();
      const answerSheetUrl = await uploadFile(
        answerSheet,
        `${profile.id}/answer_${timestamp}_${answerSheet.name}`
      );

      let questionPaperUrl = null;
      if (questionPaper) {
        questionPaperUrl = await uploadFile(
          questionPaper,
          `${profile.id}/question_${timestamp}_${questionPaper.name}`
        );
      }

      const { error } = await supabase.from('papers').insert({
        learner_id: profile.id,
        title,
        answer_sheet_url: answerSheetUrl,
        question_paper_url: questionPaperUrl,
        status: 'pending',
      });

      if (error) throw error;

      setShowUploadModal(false);
      setTitle('');
      setAnswerSheet(null);
      setQuestionPaper(null);
      loadPapers();
    } catch (error: any) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'accepted':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'checked':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const stats = {
    total: papers.length,
    pending: papers.filter(p => p.status === 'pending').length,
    accepted: papers.filter(p => p.status === 'accepted').length,
    checked: papers.filter(p => p.status === 'checked').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-600 text-sm font-medium">Total Papers</h3>
            <p className="text-3xl font-bold text-gray-800 mt-2">{stats.total}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-6">
            <h3 className="text-yellow-700 text-sm font-medium">Pending</h3>
            <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.pending}</p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-6">
            <h3 className="text-blue-700 text-sm font-medium">Being Checked</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">{stats.accepted}</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-6">
            <h3 className="text-green-700 text-sm font-medium">Completed</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">{stats.checked}</p>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">My Papers</h2>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-blue-600 transition-all"
          >
            <Upload className="w-5 h-5" />
            Upload New Paper
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {papers.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No papers uploaded yet</p>
            </div>
          ) : (
            papers.map((paper) => (
              <div key={paper.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(paper.status)}
                      <h3 className="text-xl font-semibold text-gray-800">{paper.title}</h3>
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full capitalize">
                        {paper.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                      Uploaded on {new Date(paper.created_at).toLocaleDateString()}
                    </p>

                    {paper.status === 'checked' && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-green-800">Marks: {paper.marks}</span>
                          <span className="font-semibold text-green-800">Grade: {paper.grade}</span>
                        </div>
                        {paper.feedback && (
                          <p className="text-sm text-green-700">
                            <span className="font-medium">Feedback:</span> {paper.feedback}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedPaper(paper)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Upload Answer Sheet</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Math Test Chapter 5"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Answer Sheet (Required)
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setAnswerSheet(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Question Paper (Optional)
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setQuestionPaper(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedPaper && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">{selectedPaper.title}</h2>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Status</h3>
                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full capitalize">
                  {selectedPaper.status}
                </span>
              </div>

              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Answer Sheet</h3>
                <a
                  href={selectedPaper.answer_sheet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  View Answer Sheet
                </a>
              </div>

              {selectedPaper.question_paper_url && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Question Paper</h3>
                  <a
                    href={selectedPaper.question_paper_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    View Question Paper
                  </a>
                </div>
              )}

              {selectedPaper.checked_sheet_url && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Checked Sheet</h3>
                  <a
                    href={selectedPaper.checked_sheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-500 hover:underline font-semibold"
                  >
                    View Checked Sheet
                  </a>
                </div>
              )}

              {selectedPaper.status === 'checked' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-2">Results</h3>
                  <p className="text-green-700">Marks: {selectedPaper.marks}</p>
                  <p className="text-green-700">Grade: {selectedPaper.grade}</p>
                  {selectedPaper.feedback && (
                    <p className="text-green-700 mt-2">
                      <span className="font-medium">Feedback:</span> {selectedPaper.feedback}
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedPaper(null)}
              className="mt-6 w-full px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
