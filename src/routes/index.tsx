import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SinglePageApp } from '@/pages/SinglePageApp';
import { AuthPage } from '@/pages/AuthPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<SinglePageApp />} />
      <Route path="/auth" element={<AuthPage />} />
      {/* Any unknown route redirects smoothly back to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
