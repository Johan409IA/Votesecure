import Navbar from './components/Navbar';
import AppRouter from './router/AppRouter';

export default function App() {
  return (
    <>
      <div className="banner-franja"></div>
      <Navbar />
      <div className="main-content">
        <AppRouter />
      </div>
      <footer className="footer-institucional">
        <div className="footer-franja"></div>
        <p>VotoSeguro — Sistema de Votación Digital © {new Date().getFullYear()}</p>
      </footer>
    </>
  );
}
