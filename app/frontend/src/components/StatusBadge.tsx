import React from 'react';

interface StatusBadgeProps {
  status: 'active' | 'disabled' | 'success' | 'error' | string;
  type?: 'status' | 'http' | 'provider';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'status' }) => {
  if (type === 'http') {
    const code = Number(status);
    const isSuccess = code >= 200 && code < 300;
    const isClientErr = code >= 400 && code < 500;
    return (
      <span
        className="badge"
        style={{
          backgroundColor: isSuccess ? 'var(--color-success-subtle)' : isClientErr ? 'var(--color-warning-subtle)' : 'var(--color-danger-subtle)',
          color: isSuccess ? 'var(--color-success)' : isClientErr ? 'var(--color-warning)' : 'var(--color-danger)',
          borderColor: isSuccess ? 'rgba(16, 185, 129, 0.3)' : isClientErr ? 'rgba(245, 158, 11, 0.3)' : 'rgba(244, 63, 94, 0.3)',
        }}
      >
        HTTP {status}
      </span>
    );
  }

  if (type === 'provider') {
    return <span className="badge badge-provider">{status}</span>;
  }

  const isActive = status === 'active' || status === 'success';
  return (
    <span className={`badge ${isActive ? 'badge-active' : 'badge-disabled'}`}>
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: isActive ? 'var(--color-success)' : 'var(--color-danger)',
          display: 'inline-block',
        }}
      />
      {status}
    </span>
  );
};
