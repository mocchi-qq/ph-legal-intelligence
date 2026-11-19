import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/Home";
import SearchPage from "./pages/Search";
import DocumentPage from "./pages/Document";
import ResearchPage from "./pages/Research";
import SavedPage from "./pages/Saved";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/document" element={<DocumentPage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/saved" element={<SavedPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
