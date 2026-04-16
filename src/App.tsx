import { BrowserRouter, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "@/components/AppShell";
import CaseloadOverview from "./pages/CaseloadOverview";
import CaseDetail from "./pages/CaseDetail";
import ActionStub from "./pages/ActionStub";
import NotFound from "./pages/NotFound";

const App = () => (
  <TooltipProvider delayDuration={150}>
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<CaseloadOverview />} />
          <Route path="/case/:caseId" element={<CaseDetail />} />
          <Route path="/case/:caseId/action/:actionId" element={<ActionStub />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
