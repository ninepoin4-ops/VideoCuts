import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { HomePage } from "./pages/HomePage";
import { AdvancedPage } from "./pages/AdvancedPage";
import { TasksPage } from "./pages/TasksPage";
import { ResultsPage } from "./pages/ResultsPage";
import { MaterialLibraryPage } from "./pages/MaterialLibraryPage";

export default function App() {
  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/advanced" element={<AdvancedPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:taskId/results" element={<ResultsPage />} />
          <Route path="/files" element={<MaterialLibraryPage />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}
