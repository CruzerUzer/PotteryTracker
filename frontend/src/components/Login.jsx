import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(formData.username, formData.password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '400px', margin: '50px auto' }}>
      <h2>Login</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label htmlFor="username" style={{ marginBottom: '6px' }}>Username</label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            style={{ padding: '8px 12px' }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label htmlFor="password" style={{ marginBottom: '6px' }}>Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            style={{ padding: '8px 12px' }}
          />
        </div>
        <div className="btn-group" style={{ marginTop: '16px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '8px 20px', fontSize: '0.9rem' }}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
          <Link to="/register" className="btn btn-secondary" style={{ padding: '8px 20px', fontSize: '0.9rem', textDecoration: 'none', display: 'inline-block' }}>
            Register
          </Link>
        </div>
      </form>
    </div>
  );
}

export default Login;

