import Layout from "./Layout.jsx";
import Dashboard from "./Dashboard";
import Accounts from "./Accounts";
import Tags from "./Tags";
import Transactions from "./Transactions";
import TransactionsV2 from "./TransactionsV2";
import Budgets from "./Budgets";
import Reports from "./Reports";
import Import from "./Import";
import LoginPage from "./Login.jsx"; // Import the new Login page

import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import React from "react"; 
import { auth } from "@/lib/api";

const PAGES = {
    Dashboard: Dashboard,
    Accounts: Accounts,
    Tags: Tags,
    Transactions: Transactions,
    TransactionsV2: TransactionsV2,
    Budgets: Budgets,
    Reports: Reports,
    // LoginPage is not a main page in the layout sense
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
// This component will wrap routes that require authentication
const ProtectedRoute = ({ children }) => {
    const [session, setSession] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const location = useLocation();

    React.useEffect(() => {
        const getSession = async () => {
            const { data: { session: currentSession } } = await auth.getSession();
            setSession(currentSession);
            setLoading(false);
        };

        getSession();
    }, []);

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen">Carregando sessão...</div>; // Or a proper loader
    }

    if (!session) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};


function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    // Do not wrap LoginPage with Layout
    if (location.pathname === "/login") {
        return <Routes><Route path="/login" element={<LoginPage />} /></Routes>;
    }

    return (
        <Layout currentPageName={currentPage}>
            <Routes>
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/Dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/Accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
                <Route path="/Tags" element={<ProtectedRoute><Tags /></ProtectedRoute>} />
                <Route path="/Transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
                <Route path="/TransactionsV2" element={<ProtectedRoute><TransactionsV2 /></ProtectedRoute>} />
                <Route path="/Budgets" element={<ProtectedRoute><Budgets /></ProtectedRoute>} />
                <Route path="/Reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="/Import" element={<ProtectedRoute><Import /></ProtectedRoute>} />
                {/* LoginPage is handled outside Layout to prevent sidebar/header on login screen */}
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <Routes>
                {/* Route for login page, not wrapped by Layout or ProtectedRoute initially */}
                <Route path="/login" element={<LoginPage />} />
                {/* All other routes are handled by PagesContent which includes Layout and ProtectedRoute */}
                <Route path="/*" element={<PagesContent />} />
            </Routes>
        </Router>
    );
}