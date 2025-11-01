import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Contract, Wallet } from 'ethers';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { encryptLocationText } from '../utils/encryption';
import '../styles/RecordLocation.css';

// const PLACEHOLDER_ADDRESS = '0x0000000000000000000000000000000000000000';

interface RecordLocationProps {
  onRecorded?: () => void;
}

export function RecordLocation({ onRecorded }: RecordLocationProps) {
  const { address } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [dayTag, setDayTag] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [ephemeralAddress, setEphemeralAddress] = useState<string | null>(null);
  const [encryptedPreview, setEncryptedPreview] = useState<string | null>(null);

  const isConfigured = true;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!address) {
      setFormError('Connect your wallet to submit an entry.');
      return;
    }

    if (!instance) {
      setFormError('Encryption service is not ready yet. Please retry in a moment.');
      return;
    }

    if (!signerPromise) {
      setFormError('Wallet signer unavailable. Reconnect your wallet.');
      return;
    }

    if (!isConfigured) {
      setFormError('Update CONTRACT_ADDRESS with your deployed ZeroTraceDiary address.');
      return;
    }

    if (!dayTag.trim() || !location.trim()) {
      setFormError('Please provide both the day tag and the location details.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setStatusMessage('Encrypting itinerary data...');

    try {
      const wallet = Wallet.createRandom();
      const encryptedLocation = await encryptLocationText(location.trim(), wallet.address);

      const buffer = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      buffer.addAddress(wallet.address);
      const encryptedInput = await buffer.encrypt();

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Signer is not available.');
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      setStatusMessage('Submitting transaction to the ZeroTraceDiary contract...');
      const tx = await contract.recordLocation(
        dayTag.trim(),
        encryptedLocation,
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );

      setStatusMessage('Waiting for transaction confirmation...');
      await tx.wait();

      setStatusMessage('Itinerary recorded successfully.');
      setEphemeralAddress(wallet.address);
      setEncryptedPreview(encryptedLocation);
      setLocation('');
      setDayTag(new Date().toISOString().slice(0, 10));

      onRecorded?.();
    } catch (error) {
      console.error('Failed to record location entry:', error);
      setFormError(error instanceof Error ? error.message : 'Failed to record itinerary.');
      setStatusMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="record-container">
      <div className="record-card">
        <header className="record-header">
          <h2 className="record-title">Record a daily itinerary</h2>
          <p className="record-description">
            Generate a fresh FHE-protected key for every entry. The random EVM address is stored
            privately on-chain, and the address string encrypts your location notes in the browser.
          </p>
        </header>

        {zamaError && (
          <div className="record-error">
            <strong>Encryption error:</strong> {zamaError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="record-form">
          <div className="record-field">
            <label className="record-label" htmlFor="dayTag">Day identifier</label>
            <input
              id="dayTag"
              type="text"
              value={dayTag}
              onChange={(event) => setDayTag(event.target.value)}
              placeholder="e.g. 2025-02-10"
              className="record-input"
            />
          </div>

          <div className="record-field">
            <label className="record-label" htmlFor="locationText">Encrypted location notes</label>
            <textarea
              id="locationText"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Describe your meeting point, commute, or accommodation."
              rows={4}
              className="record-textarea"
            />
          </div>

          <div className="record-actions">
            <button
              type="submit"
              className="record-button"
              disabled={isSubmitting || zamaLoading}
            >
              {zamaLoading && 'Connecting to Zama relayer...'}
              {!zamaLoading && isSubmitting && 'Recording itinerary...'}
              {!zamaLoading && !isSubmitting && 'Store encrypted itinerary'}
            </button>
            {statusMessage && <p className="record-status">{statusMessage}</p>}
            {formError && <p className="record-error-inline">{formError}</p>}
          </div>
        </form>

        {ephemeralAddress && (
          <div className="record-success">
            <h3 className="record-success-title">Entry secured</h3>
            <p className="record-success-text">
              Your itinerary is stored with this one-time encryption address:
            </p>
            <code className="record-code">{ephemeralAddress}</code>
            {encryptedPreview && (
              <p className="record-success-text">
                Cipher text stored on-chain: <code className="record-code">{encryptedPreview}</code>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
