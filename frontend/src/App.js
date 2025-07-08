import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Import all your screens/components
import Login from './screens/Login';
import AdminDashboard from './screens/Admin'; // This is your AdminPanel component
import ScanPage from './screens/Scanner';
import HistoryScreen from './screens/history'; // Assuming this is for /admin/history
import ManageEmpScreen from './screens/ManageEmp'; // Assuming this is for /admin/emps
import ManageGamesScreen from './screens/ManageGames'; // Assuming this is for /admin/games
import TransactionScreen from './screens/Transaction'; // Assuming this is for /admin/reports (or similar)
import AddGameScreen from './screens/addGame'; // If you have an add game screen
import UpdateEmpScreen from './screens/updateEmp'; // If you have an update employee screen
import UpdateGamesScreen from './screens/updateGames'; // If you have an update games screen
import AddCardScreen from './screens/AddCard'; // If you have an add card screen
import RechargeScreen from './screens/RechargeScreen'; // If you have a recharge screen
import Registration from './screens/Employee_Reg';


// A simple PrivateRoute component to protect routes
const PrivateRoute = ({ children, allowedRoles, requiredRoute }) => {
  const { authStatus, loading } = useAuth();

  if (loading) {
    return <div>Loading authentication...</div>; // Or a spinner
  }

  if (!authStatus.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

//   if (allowedRoles && !allowedRoles.includes(authStatus.user?.role)) {
//     console.warn(`Access Denied: User role '${authStatus.user?.role}' not in allowed roles [${allowedRoles.join(', ')}] for route '${location.pathname}'`);
//     return <Navigate to="/unauthorized" replace />; // Redirect to an unauthorized page
//   }

  if (requiredRoute && !authStatus.accessibleRoutes.includes(requiredRoute)) {
      console.warn(`Access Denied: User does not have access to required route '${requiredRoute}'. Accessible routes:`, authStatus.accessibleRoutes);
      return <Navigate to="/unauthorized" replace />; // Redirect if route not in accessibleRoutes
  }

  return children;
};

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
};

const AppContent = () => {
    const { authStatus } = useAuth();

    return (
        <Routes>
            <Route path="/" element={<Login />} />

            {/* <Route path="/" element={
                authStatus.loading ? <div>Loading...</div> :
                (authStatus.isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />)
            } /> */}

            {/* General Protected Routes
            <Route path="/dashboard" element={
                <PrivateRoute>
                    <Dashboard />
                </PrivateRoute>
            } /> */}
            <Route path="/unauthorized" element={<div>You are not authorized to view this page.</div>} />

            {/* Employee/Cashier Accessible Routes (also accessible by Manager/Admin) */}
            <Route path="/scan" element={
                <PrivateRoute allowedRoles={['employee', 'manager', 'admin']} requiredRoute="/scan">
                    <ScanPage />
                </PrivateRoute>
            } />
            {/* Assuming /card/check-card and /card/recharge are handled by Scanner/RechargeScreen */}
            <Route path="/recharge" element={
                <PrivateRoute allowedRoles={['employee', 'manager', 'admin']} requiredRoute="/card/recharge">
                    <RechargeScreen />
                </PrivateRoute>
            } />
            <Route path="/add-card" element={
                <PrivateRoute allowedRoles={['manager', 'admin']} requiredRoute="/card/issue">
                    <AddCardScreen />
                </PrivateRoute>
            } />

       


            {/* Admin Panel Routes (Specific to Admin/Manager roles) */}
            {/* This is the Admin Panel itself */}
            <Route path="/admin" element={
                <PrivateRoute allowedRoles={['admin', 'manager']} requiredRoute="/admin/transactions"> {/* Default admin landing */}
                    <AdminDashboard />
                </PrivateRoute>
            } />

                 <Route path="/register" element={
                <PrivateRoute allowedRoles={['manager', 'admin']} requiredRoute="/register">
                    <Registration />
                </PrivateRoute>
            } />

            {/* Routes linked from Admin Panel tiles */}
            <Route path="/admin/reports" element={
                <PrivateRoute allowedRoles={['admin', 'manager']} requiredRoute="/admin/transactions"> {/* Matches backend path */}
                    <TransactionScreen /> {/* Assuming TransactionScreen handles /admin/transactions */}
                </PrivateRoute>
            } />
            <Route path="/admin/history" element={
                <PrivateRoute allowedRoles={['admin', 'manager']} requiredRoute="/admin/history">
                    <HistoryScreen />
                </PrivateRoute>
            } />
            <Route path="/admin/emps" element={
                <PrivateRoute allowedRoles={['admin', 'manager']} requiredRoute="/admin/emps">
                    <ManageEmpScreen />
                </PrivateRoute>
            } />
            {/* Add route for /admin/updateEmp if it's a separate screen */}
            <Route path="/admin/games" element={
                <PrivateRoute allowedRoles={['admin', 'manager']} requiredRoute="/games/gameList">
                    <ManageGamesScreen />
                </PrivateRoute>
            } />
            {/* Add routes for /admin/addgames and /admin/updategame if they are separate screens */}
            <Route path="/admin/addgames" element={
                <PrivateRoute allowedRoles={['admin', 'manager']} requiredRoute="/games/add">
                    <AddGameScreen />
                </PrivateRoute>
            } />
            <Route path="/admin/updategame" element={
                <PrivateRoute allowedRoles={['admin', 'manager']} requiredRoute="/games/update">
                    <UpdateGamesScreen />
                </PrivateRoute>
            } />
            <Route path="/admin/updateEmp" element={
                <PrivateRoute allowedRoles={['admin', 'manager']} requiredRoute="/admin/updateEmp">
                    <UpdateEmpScreen />
                </PrivateRoute>
            } />


            {/* Catch-all for undefined routes */}
            <Route path="*" element={<div>404 Not Found</div>} />
        </Routes>
    );
};

export default App;
