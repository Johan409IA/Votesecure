import '../pages/AuthPages.css';

// Marco común de login, registro y verificación de correo:
// a la izquierda el mensaje con la ilustración, a la derecha la tarjeta.
export default function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <section className="auth-hero" aria-hidden="true">
        <h1>
          Votación segura para escoger a tu <span>delegado</span>
        </h1>
        <p>Participa de forma sencilla y segura en la elección del delegado de tus cursos.</p>
        <img
          className="auth-hero-img"
          src="/assets/login_asset.jpeg"
          alt=""
          width="620"
          height="465"
        />
      </section>

      <main className="auth-card">
        <img className="auth-logo" src="/assets/logo_votesecure.png" alt="VoteSecure UTP" />
        {children}
      </main>
    </div>
  );
}
