import { BrowserRouter, Route, Routes } from "react-router-dom";
import CaseloadOverview from "./pages/CaseloadOverview";
import CaseDetail from "./pages/CaseDetail";
import ActionStub from "./pages/ActionStub";
import NotFound from "./pages/NotFound";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<CaseloadOverview />} />
      <Route path="/case/:caseId" element={<CaseDetail />} />
      <Route path="/case/:caseId/action/:actionId" element={<ActionStub />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
