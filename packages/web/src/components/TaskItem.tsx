import { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Task } from '@clawkeeper/shared/src/types';
import { ENABLE_AUTO_REFLECTION } from '@clawkeeper/shared/src/constants';
import { getDueDateStatus, formatDueDate } from '@clawkeeper/shared/src/utils';
import { fetchAgents } from '../lib/api';

type RevealedItem = { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'add-subtask' | 'notes' } | null;

interface TaskItemProps {
  task: Task;
  depth: number;
  showCompleted: boolean;
  onToggle: (id: string) => void;
  onAddNote: (id: string, text: string) => void;
  onEditNote: (id: string, noteId: string, newNoteText: string) => void;
  onDeleteNote: (id: string, noteId: string) => void;
  onAddSubtask: (parentId: string, text: string) => void;
  onDelete: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onUpdateDueDate: (id: string, dueDate: string | null) => void;
  onUpdateAgent?: (id: string, agentId: string | null) => void;
  allAgents?: Array<{ id: string; name?: string }>;
  revealedItem: RevealedItem;
  onSetRevealed: (item: RevealedItem) => void;
  isDragOverlay?: boolean;
}

export function TaskItem({
  task,
  depth,
  showCompleted,
  onToggle,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onAddSubtask,
  onDelete,
  onUpdateText,
  onUpdateDueDate,
  onUpdateAgent,
  allAgents,
  revealedItem,
  onSetRevealed,
  isDragOverlay,
}: TaskItemProps) {
  const [reflectionText, setReflectionText] = useState('');
  const [subtaskText, setSubtaskText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [pendingCompletion, setPendingCompletion] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [agents, setAgents] = useState<Array<{ id: string; name?: string }>>([]);

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: isDragOverlay,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${task.id}`,
    data: { taskId: task.id },
    disabled: isDragOverlay,
  });

  const showReflectionInput = revealedItem?.type === 'task' && revealedItem?.id === task.id && revealedItem?.mode === 'reflection';
  const showAddSubtask = revealedItem?.type === 'task' && revealedItem?.id === task.id && revealedItem?.mode === 'add-subtask';
  const showNotes = revealedItem?.type === 'task' && revealedItem?.id === task.id && revealedItem?.mode === 'notes';
  const isExpanded = revealedItem?.type === 'task' && revealedItem?.id === task.id && revealedItem?.mode === 'edit';

  const visibleChildren = showCompleted
    ? task.children
    : task.children?.filter((child) => !child.completed) || [];

  if (!showCompleted && task.completed && visibleChildren.length === 0 && !showReflectionInput) {
    return null;
  }

  const isVisuallyCompleted = task.completed || pendingCompletion;

  const handleToggle = () => {
    if (task.completed) {
      onToggle(task.id);
      setPendingCompletion(false);
      onSetRevealed(null);
    } else if (pendingCompletion) {
      setPendingCompletion(false);
      onSetRevealed(null);
    } else {
      if (ENABLE_AUTO_REFLECTION) {
        setPendingCompletion(true);
        onSetRevealed({ type: 'task', id: task.id, mode: 'reflection' });
      } else {
        onToggle(task.id);
      }
    }
  };

  const handleSaveReflection = () => {
    if (reflectionText.trim()) onAddNote(task.id, reflectionText.trim());
    setReflectionText('');
    setPendingCompletion(false);
    onSetRevealed(null);
    onToggle(task.id);
  };

  const handleSkipReflection = () => {
    setReflectionText('');
    setPendingCompletion(false);
    onSetRevealed(null);
    onToggle(task.id);
  };

  const handleAddSubtask = () => {
    if (subtaskText.trim()) {
      onAddSubtask(task.id, subtaskText.trim());
      setSubtaskText('');
      onSetRevealed(null);
    }
  };

  const handleSaveNote = () => {
    if (noteText.trim()) {
      onAddNote(task.id, noteText.trim());
      setNoteText('');
    }
  };

  const handleSaveText = () => {
    if (editText.trim()) onUpdateText(task.id, editText.trim());
    setIsEditingText(false);
  };

  return (
    <div
      ref={(node) => { if (!isDragOverlay) { setDragRef(node); setDropRef(node); } }}
      {...(isDragOverlay ? {} : { ...listeners, ...attributes })}
      className={`${depth > 0 ? 'ml-2.5 pl-5 border-l-2 border-l-tokyo-border' : ''} ${isDragging ? 'opacity-30' : ''} ${isOver && !isDragging ? 'ring-2 ring-tokyo-blue rounded-lg bg-tokyo-blue/5' : ''} ${isDragOverlay ? 'bg-tokyo-surface rounded-xl shadow-lg px-3' : ''}`}
      style={isDragOverlay ? { width: '85vw', maxWidth: 500 } : undefined}
    >
      <div className={`group py-2.5 ${task.completed && !showReflectionInput ? 'opacity-40' : ''}`}>
        <div className="flex items-start gap-2.5">
          <button
            onClick={handleToggle}
            className={`mt-0.5 w-6 h-6 rounded border-2 flex items-center justify-center transition-all flex-shrink-0
              ${isVisuallyCompleted
                ? 'bg-tokyo-green border-tokyo-green text-white'
                : 'border-tokyo-blue/40 active:border-tokyo-blue'
              }`}
          >
            {isVisuallyCompleted && (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                {isEditingText ? (
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleSaveText}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveText();
                      if (e.key === 'Escape') { setEditText(task.text); setIsEditingText(false); }
                    }}
                    className="w-full px-3 py-2 bg-tokyo-surface-alt border border-tokyo-border rounded-lg focus:outline-none focus:ring-1 focus:ring-tokyo-blue text-sm"
                    autoFocus
                  />
                ) : (
                  <span className="inline-flex items-center gap-1.5 flex-wrap">
                    <span
                      onClick={() => {
                        if (showNotes) onSetRevealed(null);
                        else onSetRevealed({ type: 'task', id: task.id, mode: 'notes' });
                      }}
                      className={`text-sm text-tokyo-text-bright ${isVisuallyCompleted && !showReflectionInput ? 'line-through text-tokyo-text-muted' : ''} cursor-pointer active:text-tokyo-blue`}
                    >
                      {task.text}
                    </span>
                    {!task.completed && task.dueDate && (() => {
                      const status = getDueDateStatus(task.dueDate);
                      const label = formatDueDate(task.dueDate);
                      const colorClass =
                        status === 'overdue' ? 'text-tokyo-red bg-tokyo-red/10' :
                        status === 'due-today' ? 'text-tokyo-yellow bg-tokyo-yellow/10' :
                        status === 'upcoming' ? 'text-tokyo-cyan bg-tokyo-cyan/10' :
                        'text-tokyo-text-dim bg-tokyo-surface-alt';
                      return (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${colorClass}`}>
                          {label}
                        </span>
                      );
                    })()}
                    {!task.completed && task.agentId && (
                      <span
                        onClick={(e) => { e.stopPropagation(); onSetRevealed({ type: 'task', id: task.id, mode: 'edit' }); }}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-tokyo-magenta/10 text-tokyo-magenta cursor-pointer"
                      >
                        {allAgents?.find(a => a.id === task.agentId)?.name || task.agentId}
                      </span>
                    )}
                  </span>
                )}
              </div>

              {!isVisuallyCompleted && (
                <>
                  <button
                    onClick={() => onSetRevealed({ type: 'task', id: task.id, mode: 'add-subtask' })}
                    className="p-1.5 text-tokyo-text-dim active:text-tokyo-text-muted rounded flex-shrink-0"
                    title="Add subtask"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onSetRevealed({ type: 'task', id: task.id, mode: 'notes' })}
                    className="relative p-1.5 text-tokyo-text-dim active:text-tokyo-text-muted rounded flex-shrink-0"
                    title="Notes"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {task.notes && task.notes.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-tokyo-yellow text-tokyo-bg text-[9px] font-bold rounded-full flex items-center justify-center">
                        {task.notes.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => onSetRevealed(isExpanded ? null : { type: 'task', id: task.id, mode: 'edit' })}
                    className="p-1.5 text-tokyo-text-dim active:text-tokyo-text-muted rounded flex-shrink-0"
                    title="Edit task"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="5" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="19" r="2" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {isExpanded && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <button onClick={() => setIsEditingText(true)} className="text-xs text-tokyo-cyan active:text-tokyo-text">
                  Edit name
                </button>
                <span className="text-tokyo-text-dim">{'\u00B7'}</span>
                <label className="text-xs text-tokyo-cyan active:text-tokyo-text cursor-pointer">
                  {task.dueDate ? 'Change due date' : 'Set due date'}
                  <input
                    type="date"
                    className="sr-only"
                    value={task.dueDate || ''}
                    onChange={(e) => onUpdateDueDate(task.id, e.target.value || null)}
                  />
                </label>
                {task.dueDate && (
                  <>
                    <span className="text-tokyo-text-dim">{'\u00B7'}</span>
                    <button onClick={() => onUpdateDueDate(task.id, null)} className="text-xs text-tokyo-text-muted active:text-tokyo-text">
                      Clear due date
                    </button>
                  </>
                )}
                {onUpdateAgent && (
                  <>
                    <span className="text-tokyo-text-dim">{'\u00B7'}</span>
                    {task.agentId ? (
                      <span className="inline-flex items-center gap-1 text-xs text-tokyo-magenta">
                        {allAgents?.find(a => a.id === task.agentId)?.name || task.agentId}
                        <button
                          onClick={() => { onUpdateAgent(task.id, null); setShowAgentPicker(false); }}
                          className="active:text-tokyo-red"
                        >
                          {'\u2715'}
                        </button>
                      </span>
                    ) : showAgentPicker ? (
                      <span className="inline-flex items-center gap-1">
                        {agents.length > 0 ? agents.map((agent) => (
                          <button
                            key={agent.id}
                            onClick={() => { onUpdateAgent(task.id, agent.id); setShowAgentPicker(false); }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-tokyo-magenta/10 text-tokyo-magenta active:bg-tokyo-magenta/20"
                          >
                            {agent.name || agent.id}
                          </button>
                        )) : (
                          <span className="text-xs text-tokyo-text-dim">No agents found</span>
                        )}
                        <button
                          onClick={() => setShowAgentPicker(false)}
                          className="text-xs text-tokyo-text-dim active:text-tokyo-text-muted"
                        >
                          {'\u2715'}
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={async () => {
                          const fetched = await fetchAgents();
                          setAgents(fetched);
                          setShowAgentPicker(true);
                        }}
                        className="text-xs text-tokyo-magenta active:text-tokyo-text"
                      >
                        Assign agent
                      </button>
                    )}
                  </>
                )}
                <span className="text-tokyo-text-dim">{'\u00B7'}</span>
                <button onClick={() => onDelete(task.id)} className="text-xs text-tokyo-red active:text-tokyo-red/80">
                  Delete
                </button>
                <span className="text-tokyo-text-dim">{'\u00B7'}</span>
                <button onClick={() => { onSetRevealed(null); setShowAgentPicker(false); }} className="text-xs text-tokyo-text-muted active:text-tokyo-text">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Add subtask input */}
        {showAddSubtask && (
          <div className="mt-2 ml-6 flex gap-2">
            <input
              type="text"
              value={subtaskText}
              onChange={(e) => setSubtaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSubtask();
                if (e.key === 'Escape') { setSubtaskText(''); onSetRevealed(null); }
              }}
              placeholder="Subtask..."
              className="flex-1 px-3 py-1.5 text-sm bg-tokyo-surface-alt border border-tokyo-border rounded-lg focus:outline-none focus:ring-1 focus:ring-tokyo-blue"
              autoFocus
            />
            <button onClick={handleAddSubtask} className="px-3 py-1.5 text-xs bg-tokyo-blue text-white rounded-lg">
              Add
            </button>
            <button
              onClick={() => { setSubtaskText(''); onSetRevealed(null); }}
              className="px-2 py-1.5 text-xs text-tokyo-text-muted"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Reflection input after completing */}
        {showReflectionInput && (
          <div className="mt-2 ml-6 p-3 bg-tokyo-surface-alt rounded-lg border border-tokyo-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-tokyo-text-muted font-medium">Any reflection?</p>
              <button onClick={handleSkipReflection} className="text-xs text-tokyo-text-dim active:text-tokyo-text-muted">
                Skip
              </button>
            </div>
            <div>
              <textarea
                value={reflectionText}
                onChange={(e) => setReflectionText(e.target.value)}
                placeholder="What worked today? Anything to remember?"
                className="w-full px-3 py-2 text-sm bg-tokyo-surface-alt border border-tokyo-border rounded-lg focus:outline-none focus:ring-1 focus:ring-tokyo-blue resize-none"
                rows={2}
                autoFocus
              />
              {reflectionText.trim() && (
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setReflectionText('')} className="px-3 py-1 text-xs text-tokyo-text-muted">
                    Clear
                  </button>
                  <button onClick={handleSaveReflection} className="px-4 py-2 text-xs bg-tokyo-blue text-white rounded-lg">
                    Save
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes panel */}
        {showNotes && (
          <div className="mt-2 ml-6 p-3 bg-tokyo-surface-alt rounded-lg border border-tokyo-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-tokyo-text-muted font-medium">Notes</p>
              <button
                onClick={() => { onSetRevealed(null); setNoteText(''); setEditingNoteId(null); }}
                className="text-xs text-tokyo-text-dim active:text-tokyo-text-muted"
              >
                Close
              </button>
            </div>

            {task.notes && task.notes.length > 0 && (
              <div className="space-y-2 mb-3">
                {task.notes.map((note) => (
                  <div key={note.id} className="group/note text-sm text-tokyo-text px-3 py-2 border-l-2 border-tokyo-yellow">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] text-tokyo-text-dim block mb-0.5">
                        {new Date(note.createdAt).toLocaleString()}
                      </span>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.text); }}
                          className="text-[10px] text-tokyo-text-dim active:text-tokyo-text-muted"
                        >
                          Edit
                        </button>
                        <span className="text-tokyo-text-dim">{'\u00B7'}</span>
                        <button
                          onClick={() => onDeleteNote(task.id, note.id)}
                          className="text-[10px] text-tokyo-red active:text-tokyo-red/80"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {editingNoteId === note.id ? (
                      <div className="mt-1">
                        <textarea
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-tokyo-surface-alt border border-tokyo-border rounded-lg focus:outline-none focus:ring-1 focus:ring-tokyo-blue resize-none"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex justify-end gap-2 mt-1">
                          <button onClick={() => setEditingNoteId(null)} className="px-3 py-1 text-xs text-tokyo-text-muted">
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              if (editingNoteText.trim()) onEditNote(task.id, note.id, editingNoteText.trim());
                              setEditingNoteId(null);
                            }}
                            className="px-3 py-1 text-xs bg-tokyo-blue text-white rounded-lg"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap">{note.text}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note..."
                className="w-full px-3 py-2 text-sm bg-tokyo-surface-alt border border-tokyo-border rounded-lg focus:outline-none focus:ring-1 focus:ring-tokyo-blue resize-none"
                rows={2}
                autoFocus
              />
              {noteText.trim() && (
                <div className="flex justify-end mt-2">
                  <button onClick={handleSaveNote} className="px-4 py-2 text-xs bg-tokyo-blue text-white rounded-lg">
                    Save
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recursive render of children */}
      {visibleChildren.map((child) => (
        <TaskItem
          key={child.id}
          task={child}
          depth={depth + 1}
          showCompleted={showCompleted}
          onToggle={onToggle}
          onAddNote={onAddNote}
          onEditNote={onEditNote}
          onDeleteNote={onDeleteNote}
          onAddSubtask={onAddSubtask}
          onDelete={onDelete}
          onUpdateText={onUpdateText}
          onUpdateDueDate={onUpdateDueDate}
          onUpdateAgent={onUpdateAgent}
          allAgents={allAgents}
          revealedItem={revealedItem}
          onSetRevealed={onSetRevealed}
          isDragOverlay={isDragOverlay}
        />
      ))}
    </div>
  );
}
