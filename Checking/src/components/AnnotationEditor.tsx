import { useState, useRef, useEffect } from 'react';
import { type Paper, supabase } from '../lib/supabase';
import { X, Save } from 'lucide-react';

interface AnnotationEditorProps {
  paper: Paper;
  onClose: () => void;
}

export default function AnnotationEditor({ paper, onClose }: AnnotationEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#ff0000');
  const [marks, setMarks] = useState('');
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      setImageLoaded(true);
    };
    img.src = paper.answer_sheet_url;
  }, [paper.answer_sheet_url]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = penColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleSubmit = async () => {
    if (!marks || !grade) {
      alert('Please fill in marks and grade');
      return;
    }

    setSaving(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not found');

      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error('Failed to create blob');

        const timestamp = Date.now();
        const fileName = `checked_${timestamp}.png`;
        const filePath = `${paper.learner_id}/checked_${paper.id}_${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('papers')
          .upload(filePath, blob, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('papers')
          .getPublicUrl(uploadData.path);

        const { error: updateError } = await supabase
          .from('papers')
          .update({
            status: 'checked',
            checked_sheet_url: urlData.publicUrl,
            marks: parseInt(marks),
            grade,
            feedback,
            updated_at: new Date().toISOString(),
          })
          .eq('id', paper.id);

        if (updateError) throw updateError;

        await supabase.from('notifications').insert({
          user_id: paper.learner_id,
          paper_id: paper.id,
          message: `Your paper "${paper.title}" has been checked! Grade: ${grade}, Marks: ${marks}`,
        });

        alert('Paper checked successfully!');
        onClose();
      }, 'image/png');
    } catch (error: any) {
      alert('Error saving: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Annotate Paper: {paper.title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-auto p-4 bg-gray-100">
            <div className="flex justify-center">
              {!imageLoaded && (
                <div className="text-gray-500">Loading image...</div>
              )}
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="border border-gray-300 cursor-crosshair max-w-full"
                style={{ display: imageLoaded ? 'block' : 'none' }}
              />
            </div>
          </div>

          <div className="w-80 bg-white p-6 border-l overflow-auto">
            <h3 className="font-bold text-lg mb-4">Annotation Tools</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pen Color
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPenColor('#ff0000')}
                    className={`w-10 h-10 rounded-lg bg-red-500 ${
                      penColor === '#ff0000' ? 'ring-4 ring-red-300' : ''
                    }`}
                  />
                  <button
                    onClick={() => setPenColor('#00ff00')}
                    className={`w-10 h-10 rounded-lg bg-green-500 ${
                      penColor === '#00ff00' ? 'ring-4 ring-green-300' : ''
                    }`}
                  />
                  <button
                    onClick={() => setPenColor('#0000ff')}
                    className={`w-10 h-10 rounded-lg bg-blue-500 ${
                      penColor === '#0000ff' ? 'ring-4 ring-blue-300' : ''
                    }`}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-bold text-lg mb-4">Grading</h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Marks
                    </label>
                    <input
                      type="number"
                      value={marks}
                      onChange={(e) => setMarks(e.target.value)}
                      placeholder="e.g., 85"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Grade
                    </label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select grade</option>
                      <option value="A+">A+</option>
                      <option value="A">A</option>
                      <option value="B+">B+</option>
                      <option value="B">B</option>
                      <option value="C+">C+</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                      <option value="F">F</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Feedback
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Optional feedback for the learner..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-blue-500 text-white py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-blue-600 transition-all disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Submit Checked Paper'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
