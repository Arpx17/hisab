import { useState } from 'react';
import { setupMe } from '../lib/store';

export default function Onboarding() {
  const [name, setName] = useState('');
  return (
    <div className="onboard">
      <div className="logo">🧾</div>
      <h1>Welcome to Hisab</h1>
      <p>Split bills with friends, trips and flatmates. No sign-up, and your friends only need a name — no phone or email.</p>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="me">What should we call you?</label>
        <input id="me" className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <button className="btn block" style={{ marginTop: 16 }} disabled={!name.trim()} onClick={() => setupMe(name)}>
        Get started
      </button>
      <p className="hint" style={{ margin: '14px 0 0', textAlign: 'center' }}>
        Everything stays on this phone. You can back it up from Account.
      </p>
    </div>
  );
}
