import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    // Token validation would be done on submit, but we could check here if needed
    setValidating(false);
    setValid(true);
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Lösenorden stämmer inte överens');
      return;
    }

    if (formData.password.length < 8) {
      setError('Lösenordet måste vara minst 8 tecken');
      return;
    }

    setLoading(true);

    try {
      await authAPI.resetPasswordWithToken(token, formData.password);
      navigate('/login', { state: { message: 'Lösenordet är återställt. Logga in med ditt nya lösenord.' } });
    } catch (err) {
      setError(err.message || 'Återställningen misslyckades');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">Kontrollerar länken…</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Ogiltig länk</CardTitle>
            <CardDescription>Återställningslänken är ogiltig eller har gått ut. Be om en ny.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/login">Till inloggningen</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Välj nytt lösenord</CardTitle>
          <CardDescription>Skriv in ett nytt lösenord för ditt konto</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nytt lösenord (minst 8 tecken)</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Bekräfta nytt lösenord</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Sparar…' : 'Spara nytt lösenord'}
              </Button>
              <Button type="button" variant="secondary" asChild>
                <Link to="/login">Avbryt</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default ResetPassword;




