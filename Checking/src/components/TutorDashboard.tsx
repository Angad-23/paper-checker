import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase,type Paper } from '../lib/supabase';
import { FileText, CheckCircle, XCircle, Eye, Download, Edit } from 'lucide-react';
import Navbar from './Navbar';
import AnnotationEditor from './AnnotationEditor';

export default function TutorDashboard() {
  const { profile } = useAuth();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadPapers();

    const subscription = supabase
      .channel('tutor_papers_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'papers',
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
      .or(`tutor_id.eq.${profile.id},status.eq.pending`)
      .order('created_at', { ascending: false });

    if (data) {
      setPapers(data);
    }
  };

  const handleAccept = async (paper: Paper) => {
    try {
      const { error } = await supabase
        .from('papers')
        .update({
          tutor_id: profile?.id,
          status: 'accepted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', paper.id);

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: paper.learner_id,
        paper_id: paper.id,
        message: `Your paper "${paper.title}" has been accepted by a tutor and is being checked.`,
      });

      loadPapers();
    } catch (error: any) {
      alert('Error accepting paper: ' + error.message);
    }
  };

  const handleReject = async (paper: Paper) => {
    try {
      const { error } = await supabase
        .from('papers')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', paper.id);

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: paper.learner_id,
        paper_id: paper.id,
        message: `Your paper "${paper.title}" was not accepted for checking.`,
      });

      loadPapers();
    } catch (error: any) {
      alert('Error rejecting paper: ' + error.message);
    }
  };

  const downloadAsWord = async (paper: Paper) => {
    alert('Word document generation will download the answer sheet. In a production environment, this would generate a .docx file with embedded content.');

    const link = document.createElement('a');
    link.href = paper.answer_sheet_url;
    link.download = `${paper.title}_answer_sheet`;
    link.click();
  };

  const openAnnotationEditor = (paper: Paper) => {
    setSelectedPaper(paper);
    setShowAnnotationEditor(true);
  };

  const filteredPapers = papers.filter(paper => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return paper.status === 'pending';
    if (filterStatus === 'mine') return paper.tutor_id === profile?.id;
    return true;
  });

  const stats = {
    pending: papers.filter(p => p.status === 'pending').length,
    myPapers: papers.filter(p => p.tutor_id === profile?.id && p.status !== 'rejected').length,
    completed: papers.filter(p => p.tutor_id === profile?.id && p.status === 'checked').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-yellow-50 rounded-lg shadow p-6">
            <h3 className="text-yellow-700 text-sm font-medium">Pending Papers</h3>
            <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.pending}</p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-6">
            <h3 className="text-blue-700 text-sm font-medium">My Papers</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">{stats.myPapers}</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-6">
            <h3 className="text-green-700 text-sm font-medium">Completed</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">{stats.completed}</p>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Papers</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilterStatus('mine')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'mine'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              My Papers
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {filteredPapers.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No papers found</p>
            </div>
          ) : (
            filteredPapers.map((paper) => (
              <div key={paper.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">{paper.title}</h3>
                    <div className="flex items-center gap-4 mb-4">
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full capitalize">
                        {paper.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        Uploaded {new Date(paper.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {paper.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleAccept(paper)}
                            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleReject(paper)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </>
                      )}

                      {paper.status === 'accepted' && paper.tutor_id === profile?.id && (
                        <>
                          <button
                            onClick={() => downloadAsWord(paper)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Download as Word
                          </button>
                          <button
                            onClick={() => openAnnotationEditor(paper)}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                            Annotate & Check
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => setSelectedPaper(paper)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
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

      {selectedPaper && !showAnnotationEditor && (
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
                    className="text-green-500 hover:underline"
                  >
                    View Checked Sheet
                  </a>
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

      {showAnnotationEditor && selectedPaper && (
        <AnnotationEditor
          paper={selectedPaper}
          onClose={() => {
            setShowAnnotationEditor(false);
            setSelectedPaper(null);
            loadPapers();
          }}
        />
      )}
    </div>
  );
}
