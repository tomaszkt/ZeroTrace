import { useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { decryptLocationText } from '../utils/encryption';
import '../styles/LocationEntries.css';

const PLACEHOLDER_ADDRESS = '0x0000000000000000000000000000000000000000';

interface LocationEntry {
  index: number;
  dayTag: string;
  encryptedLocation: string;
  encryptionKey: string;
  createdAt: bigint;
}

interface DecryptedEntry {
  location: string;
  address: string;
}

interface LocationEntriesProps {
  refreshKey: number;
}

export function LocationEntries({ refreshKey }: LocationEntriesProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { instance } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [entries, setEntries] = useState<LocationEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [decryptingIndex, setDecryptingIndex] = useState<number | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [decryptedMap, setDecryptedMap] = useState<Record<number, DecryptedEntry>>({});

  const isConfigured = CONTRACT_ADDRESS !== PLACEHOLDER_ADDRESS;

  useEffect(() => {
    if (!address || !publicClient || !isConfigured) {
      setEntries([]);
      return;
    }

    let cancelled = false;

    const fetchEntries = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const total = await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: CONTRACT_ABI,
          functionName: 'getLocationCount',
          args: [address as `0x${string}`],
        }) as bigint;

        const items: LocationEntry[] = [];
        const count = Number(total);

        for (let idx = 0; idx < count; idx += 1) {
          const entry = await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: CONTRACT_ABI,
            functionName: 'getLocationEntry',
            args: [address as `0x${string}`, BigInt(idx)],
          }) as [string, string, string, bigint];

          items.push({
            index: idx,
            dayTag: entry[0],
            encryptedLocation: entry[1],
            encryptionKey: entry[2],
            createdAt: entry[3],
          });
        }

        if (!cancelled) {
          setEntries(items.reverse());
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load location entries:', error);
          setLoadError(error instanceof Error ? error.message : 'Failed to load entries.');
          setEntries([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchEntries();

    return () => {
      cancelled = true;
    };
  }, [address, publicClient, refreshKey, isConfigured]);

  const decryptEntry = async (entry: LocationEntry) => {
    if (!address) {
      setDecryptError('Connect your wallet to decrypt entries.');
      return;
    }
    if (!instance) {
      setDecryptError('Encryption service is not ready yet.');
      return;
    }
    if (!signerPromise) {
      setDecryptError('Wallet signer unavailable.');
      return;
    }
    if (!isConfigured) {
      setDecryptError('Update CONTRACT_ADDRESS before decrypting entries.');
      return;
    }

    setDecryptingIndex(entry.index);
    setDecryptError(null);

    try {
      const keypair = instance.generateKeypair();
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays
      );

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Signer is not available.');
      }

      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message
      );

      const signerAddress = await signer.getAddress();
      const result = await instance.userDecrypt(
        [
          {
            handle: entry.encryptionKey,
            contractAddress: CONTRACT_ADDRESS,
          },
        ],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        signerAddress,
        startTimeStamp,
        durationDays
      );

      const decryptedAddress = result[entry.encryptionKey];
      if (!decryptedAddress) {
        throw new Error('Relayer returned no decrypted address.');
      }

      const plainLocation = await decryptLocationText(entry.encryptedLocation, decryptedAddress);
      setDecryptedMap((prev) => ({
        ...prev,
        [entry.index]: {
          location: plainLocation,
          address: decryptedAddress,
        },
      }));
    } catch (error) {
      console.error('Failed to decrypt entry:', error);
      setDecryptError(error instanceof Error ? error.message : 'Failed to decrypt entry.');
    } finally {
      setDecryptingIndex(null);
    }
  };

  if (!address) {
    return (
      <div className="entries-empty">
        Connect your wallet to view encrypted itineraries.
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="entries-empty">
        Update <code>CONTRACT_ADDRESS</code> with your deployed ZeroTraceDiary address to list entries.
      </div>
    );
  }

  return (
    <div className="entries-container">
      <header className="entries-header">
        <h2 className="entries-title">My encrypted itineraries</h2>
        <p className="entries-description">
          Each itinerary stores the encrypted location string and an FHE-protected address handle.
          Decrypt an entry to recover the address key and reveal the original location.
        </p>
      </header>

      {isLoading && (
        <div className="entries-loading">Loading encrypted entries from the blockchain...</div>
      )}

      {loadError && (
        <div className="entries-error">
          <strong>Unable to load entries:</strong> {loadError}
        </div>
      )}

      {!isLoading && !loadError && entries.length === 0 && (
        <div className="entries-empty">
          No entries recorded yet. Create your first itinerary from the “Record Location” tab.
        </div>
      )}

      {entries.length > 0 && (
        <ul className="entries-list">
          {entries.map((entry) => {
            const decrypted = decryptedMap[entry.index];
            const createdAt = new Date(Number(entry.createdAt) * 1000).toLocaleString();

            return (
              <li key={`${entry.index}-${entry.encryptionKey}`} className="entry-card">
                <div className="entry-header">
                  <div>
                    <h3 className="entry-day">{entry.dayTag}</h3>
                    <p className="entry-timestamp">Stored at {createdAt}</p>
                  </div>
                  <button
                    type="button"
                    className="entry-decrypt-button"
                    onClick={() => decryptEntry(entry)}
                    disabled={decryptingIndex === entry.index}
                  >
                    {decryptingIndex === entry.index ? 'Decrypting...' : 'Decrypt entry'}
                  </button>
                </div>

                <div className="entry-body">
                  <div>
                    <span className="entry-label">Cipher text</span>
                    <code className="entry-code">{entry.encryptedLocation}</code>
                  </div>
                  <div>
                    <span className="entry-label">Cipher handle</span>
                    <code className="entry-code">{entry.encryptionKey}</code>
                  </div>
                </div>

                {decrypted && (
                  <div className="entry-decrypted">
                    <div>
                      <span className="entry-label">Recovered address key</span>
                      <code className="entry-code">{decrypted.address}</code>
                    </div>
                    <div>
                      <span className="entry-label">Decrypted location</span>
                      <p className="entry-plaintext">{decrypted.location}</p>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {decryptError && (
        <div className="entries-error">
          <strong>Decryption error:</strong> {decryptError}
        </div>
      )}
    </div>
  );
}
