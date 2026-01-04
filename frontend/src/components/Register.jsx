import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Register() {
  const [formData, setFormData] = useState({ username: '', password: '', confirmPassword: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 3) {
      setError('Password must be at least 3 characters');
      return;
    }

    setLoading(true);

    try {
      await register(formData.username, formData.password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '400px', margin: '50px auto' }}>
      <h2>Register</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label htmlFor="username" style={{ marginBottom: '6px' }}>Username</label>
          <input
            type="text"
            id="username"
            name="username"
            autoComplete="username"
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
            autoComplete="new-password"
            value={formData.password}
            onChange={handleChange}
            required
            style={{ padding: '8px 12px' }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label htmlFor="confirmPassword" style={{ marginBottom: '6px' }}>Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            style={{ padding: '8px 12px' }}
          />
        </div>
        <div className="btn-group" style={{ marginTop: '16px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '8px 20px', fontSize: '0.9rem' }}>
            {loading ? 'Registering...' : 'Register'}
          </button>
          <Link to="/login" className="btn btn-secondary" style={{ padding: '8px 20px', fontSize: '0.9rem', textDecoration: 'none', display: 'inline-block' }}>
            Login
          </Link>
        </div>
      </form>
    </div>
  );
}

export default Register;

