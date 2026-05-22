// client/src/pages/Admin/DetectionAccuracy.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { RefreshCw, TrendingUp, AlertCircle } from "lucide-react";

export default function DetectionAccuracy() {
  const [accuracy, setAccuracy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("detections"); // "detections" or "accuracy"

  useEffect(() => {
    fetchAccuracy();
  }, []);

  const fetchAccuracy = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get("/api/image-recognition/accuracy");
      console.log("✅ Accuracy data fetched:", response.data);
      setAccuracy(response.data);
    } catch (err) {
      console.error("❌ Error fetching accuracy:", err);
      setError(err.response?.data?.error || err.message);
      toast.error("Failed to load accuracy metrics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4 text-blue-600" size={40} />
          <p className="text-gray-600">Loading detection accuracy metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-red-50 border border-red-300 rounded-lg p-6 max-w-md text-center">
          <AlertCircle className="mx-auto mb-3 text-red-600" size={40} />
          <p className="text-red-800 font-bold mb-2">Error Loading Metrics</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={fetchAccuracy}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const overallStats = accuracy?.overall || {};
  const instruments = accuracy?.by_instrument || [];

  // Sort instruments
  const sortedInstruments = [...instruments].sort((a, b) => {
    if (sortBy === "accuracy") {
      return b.accuracy_percent - a.accuracy_percent;
    }
    return b.total_detections - a.total_detections;
  });

  // Prepare data for charts
  const chartData = sortedInstruments.slice(0, 10).map(inst => ({
    name: inst.instrument,
    accuracy: parseFloat(inst.accuracy_percent) || 0,
    detections: inst.total_detections,
    correct: inst.correct_detections
  }));

  const confidenceData = sortedInstruments.slice(0, 5).map(inst => ({
    name: inst.instrument,
    avg: parseFloat(inst.avg_confidence) * 100,
    min: parseFloat(inst.min_confidence) * 100,
    max: parseFloat(inst.max_confidence) * 100
  }));

  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🔬 Detection Accuracy Metrics</h1>
          <p className="text-gray-600">AI instrument detection performance analysis</p>
          <button
            onClick={fetchAccuracy}
            disabled={loading}
            className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            <RefreshCw size={18} />
            Refresh Data
          </button>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm font-semibold mb-2">TOTAL SCANS</p>
            <p className="text-3xl font-bold text-blue-600">{overallStats.total_scans || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm font-semibold mb-2">OVERALL ACCURACY</p>
            <p className="text-3xl font-bold text-green-600">{overallStats.overall_accuracy || 0}%</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm font-semibold mb-2">UNIQUE INSTRUMENTS</p>
            <p className="text-3xl font-bold text-purple-600">{overallStats.unique_instruments || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm font-semibold mb-2">TOTAL USERS</p>
            <p className="text-3xl font-bold text-orange-600">{overallStats.total_users || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm font-semibold mb-2">AVG CONFIDENCE</p>
            <p className="text-3xl font-bold text-indigo-600">{((overallStats.avg_confidence || 0) * 100).toFixed(1)}%</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Accuracy Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">📊 Accuracy by Instrument</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis label={{ value: "Accuracy %", angle: -90, position: "insideLeft" }} />
                <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                <Bar dataKey="accuracy" fill="#10b981" name="Accuracy %" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Confidence Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🎯 Confidence Levels</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={confidenceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis label={{ value: "Confidence %", angle: -90, position: "insideLeft" }} />
                <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                <Legend />
                <Bar dataKey="avg" fill="#3b82f6" name="Average" />
                <Bar dataKey="min" fill="#ef4444" name="Min" />
                <Bar dataKey="max" fill="#10b981" name="Max" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">📋 Detailed Results</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setSortBy("detections")}
                  className={`px-4 py-2 rounded font-medium transition ${
                    sortBy === "detections"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Sort by Detections
                </button>
                <button
                  onClick={() => setSortBy("accuracy")}
                  className={`px-4 py-2 rounded font-medium transition ${
                    sortBy === "accuracy"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Sort by Accuracy
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Instrument</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Total Detections</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Correct</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Accuracy %</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Avg Confidence</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Confidence Range</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Unique Users</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Last Detection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedInstruments.map((inst, idx) => {
                  const accuracy = parseFloat(inst.accuracy_percent) || 0;
                  const avgConf = parseFloat(inst.avg_confidence) || 0;
                  const minConf = parseFloat(inst.min_confidence) || 0;
                  const maxConf = parseFloat(inst.max_confidence) || 0;

                  let accuracyColor = "text-red-600";
                  if (accuracy >= 80) accuracyColor = "text-green-600";
                  else if (accuracy >= 60) accuracyColor = "text-orange-600";

                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-medium text-gray-900">{inst.instrument}</td>
                      <td className="px-6 py-4 text-gray-600">{inst.total_detections}</td>
                      <td className="px-6 py-4 text-gray-600 font-semibold text-green-600">{inst.correct_detections}</td>
                      <td className={`px-6 py-4 font-bold text-lg ${accuracyColor}`}>
                        {accuracy.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 font-semibold text-blue-600">{(avgConf * 100).toFixed(1)}%</td>
                      <td className="px-6 py-4 text-xs text-gray-600">
                        <span className="bg-gray-100 px-2 py-1 rounded">
                          {(minConf * 100).toFixed(0)}% - {(maxConf * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{inst.unique_users}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(inst.last_detection).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>📌 Note:</strong> Accuracy is calculated as <strong>correct_detections / total_detections × 100</strong>.
            A detection is "correct" if it matches an item in your inventory database.
            Low accuracy may indicate need to train the model with more data or adjust confidence thresholds.
          </p>
        </div>
      </div>
    </div>
  );
}
