import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import NewTrip from "./pages/NewTrip";
import TripDetail from "./pages/TripDetail";
import History from "./pages/History";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<NewTrip />} />
          <Route path="/trips/:id" element={<TripDetail />} />
          <Route path="/trips" element={<History />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
