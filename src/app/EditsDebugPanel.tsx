import { useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from './store';

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  right: 0,
  width: '480px',
  maxHeight: '50vh',
  overflowY: 'auto',
  background: '#1e1e1e',
  color: '#d4d4d4',
  fontFamily: 'monospace',
  fontSize: '12px',
  padding: '12px',
  borderTop: '2px solid #007acc',
  borderLeft: '2px solid #007acc',
  zIndex: 9999,
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '12px',
};

const labelStyle: React.CSSProperties = {
  color: '#569cd6',
  fontWeight: 'bold',
  marginBottom: '4px',
};

const entryStyle: React.CSSProperties = {
  paddingLeft: '12px',
  borderLeft: '2px solid #3c3c3c',
  marginBottom: '4px',
};

const keyStyle: React.CSSProperties = { color: '#9cdcfe' };
const originalStyle: React.CSSProperties = { color: '#ce9178' };
const editedStyle: React.CSSProperties = { color: '#4ec9b0' };
const dimStyle: React.CSSProperties = { color: '#6a9955' };

const EditsDebugPanel = () => {
  const [open, setOpen] = useState(false);
  const edits = useSelector((state: RootState) => state.edits);

  const propertyEditCount = Object.values(edits.propertyEdits)
    .reduce((sum, paths) => sum + Object.keys(paths).length, 0);
  const addedCount = Object.values(edits.addedEntities)
    .reduce((sum, byId) => sum + Object.keys(byId).length, 0);
  const deletedCount = Object.values(edits.deletedEntityIds)
    .reduce((sum, byId) => sum + Object.keys(byId).length, 0);

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          position: 'fixed', bottom: 8, right: 8, zIndex: 10000,
          background: '#007acc', color: '#fff', border: 'none',
          padding: '4px 10px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '12px',
        }}
      >
        Edits [{propertyEditCount}P / {addedCount}A / {deletedCount}D]
      </button>

      {open && (
        <div style={panelStyle}>
          <div style={sectionStyle}>
            <div style={labelStyle}>Property Edits</div>
            {Object.keys(edits.propertyEdits).length === 0 && (
              <div style={dimStyle}>— none —</div>
            )}
            {Object.entries(edits.propertyEdits).map(([entityId, paths]) => (
              <div key={entityId} style={entryStyle}>
                <div style={keyStyle}>{entityId}</div>
                {Object.entries(paths).map(([path, edit]) => (
                  <div key={path} style={{ paddingLeft: '12px' }}>
                    <span style={keyStyle}>{path}</span>
                    {' path: ' }
                    <span style={originalStyle}>{JSON.stringify(edit.path)}</span>
                    {' original value: '}<span style={originalStyle}>{JSON.stringify(edit.originalValue)}</span>
                    {' → '}
                    <span style={editedStyle}>{JSON.stringify(edit.editedValue)}</span>
                    <span style={dimStyle}> @{new Date(edit.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={sectionStyle}>
            <div style={labelStyle}>Added Entities</div>
            {addedCount === 0 && (
              <div style={dimStyle}>— none —</div>
            )}
            {Object.entries(edits.addedEntities).map(([entityType, byId]) =>
              Object.entries(byId).map(([id, entity]) => (
                <div key={id} style={entryStyle}>
                  <span style={dimStyle}>[{entityType}] </span>
                  <span style={keyStyle}>{id}</span>
                  {' '}
                  <span style={editedStyle}>{JSON.stringify(entity)}</span>
                </div>
              ))
            )}
          </div>

          <div style={sectionStyle}>
            <div style={labelStyle}>Deleted Entity IDs</div>
            {deletedCount === 0 && (
              <div style={dimStyle}>— none —</div>
            )}
            {Object.entries(edits.deletedEntityIds).map(([entityType, byId]) =>
              Object.entries(byId).map(([entityId, parentId]) => (
                <div key={entityId} style={entryStyle}>
                  <span style={dimStyle}>[{entityType}] </span>
                  <span style={keyStyle}>{entityId}</span>
                  <span style={dimStyle}> (parent: {parentId})</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default EditsDebugPanel;
