import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Header } from './Header';
import { RecordLocation } from './RecordLocation';
import { LocationEntries } from './LocationEntries';
import '../styles/DiaryApp.css';

type TabKey = 'record' | 'entries';

export function DiaryApp() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<TabKey>('record');
  const [refreshCounter, setRefreshCounter] = useState(0);

  const handleRecorded = () => {
    setRefreshCounter((value) => value + 1);
    setActiveTab('entries');
  };

  return (
    <div className="diary-app">
      <Header />
      <main className="diary-main">
        {!address && (
          <div className="connect-card">
            <h2 className="connect-title">Connect your wallet to start logging itineraries</h2>
            <p className="connect-description">
              Link your wallet to encrypt daily locations with Zama FHE and store them on-chain.
            </p>
          </div>
        )}
        {address && (
          <>
            <nav className="diary-tabs">
              <button
                type="button"
                className={`diary-tab ${activeTab === 'record' ? 'active' : 'inactive'}`}
                onClick={() => setActiveTab('record')}
              >
                Record Location
              </button>
              <button
                type="button"
                className={`diary-tab ${activeTab === 'entries' ? 'active' : 'inactive'}`}
                onClick={() => setActiveTab('entries')}
              >
                My Entries
              </button>
            </nav>
            <section>
              {activeTab === 'record' && <RecordLocation onRecorded={handleRecorded} />}
              {activeTab === 'entries' && <LocationEntries refreshKey={refreshCounter} />}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
