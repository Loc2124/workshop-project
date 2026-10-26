import { Route, Routes } from 'react-router-dom';

function App() {
  return (
    <Routes>
      <Route path="/" element={null} />
      <Route path="/workshops/:id" element={null} />
      <Route path="*" element={null} />
    </Routes>
  );
}

export default App;
