import React from 'react';
import { auth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react'; 

const LoginPage = () => {
  const handleLogin = async () => {
    const { error } = await auth.login();

    if (error) {
      console.error('Error logging in:', error);
    } else {
      window.location.href = '/';
    }
  };

  // Basic styling for centering
  const pageStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '20px',
    padding: '20px',
    backgroundColor: '#f9fafb' // A light gray background
  };

  const cardStyle = {
    padding: '40px',
    borderRadius: '12px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    backgroundColor: 'white',
    textAlign: 'center'
  };

  const titleStyle = {
    fontSize: '28px',
    fontWeight: '600',
    marginBottom: '10px',
    color: '#111827' // Dark gray
  };

  const subtitleStyle = {
    fontSize: '16px',
    color: '#6b7280', // Medium gray
    marginBottom: '30px'
  };


  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Bem-vindo!</h1>
        <p style={subtitleStyle}>Faça login para continuar.</p>
        <Button
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg"
        >
          <LogIn className="mr-2 h-5 w-5" /> 
          Entrar (Modo Local)
        </Button>
      </div>
    </div>
  );
};

export default LoginPage;
