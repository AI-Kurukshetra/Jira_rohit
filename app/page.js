"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase/client";

const PRIORITIES = ["P0", "P1", "P2", "P3"];
const ISSUE_TYPES = ["Story", "Bug", "Task", "Spike"];
const STATUSES = ["backlog", "sprint", "in_progress", "done", "released"];

export default function Home() {
  const [issues, setIssues] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState("board");
  const [showForm, setShowForm] = useState(false);
  const [dragStatus, setDragStatus] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [issueType, setIssueType] = useState("Story");
  const [priority, setPriority] = useState("P2");
  const [storyPoints, setStoryPoints] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [sprint, setSprint] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadIssues = async () => {
      setIsLoading(true);
      setError("");
      const { data, error: loadError } = await supabase
        .from("issues")
        .select("*")
        .order("created_at", { ascending: false });
      if (loadError) {
        setError(loadError.message);
      } else {
        setIssues(data ?? []);
      }
      setIsLoading(false);
    };
    loadIssues();
  }, []);

  const filteredIssues = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return issues;
    return issues.filter((issue) =>
      `${issue.summary}`.toLowerCase().includes(term)
    );
  }, [issues, search]);

  const backlog = filteredIssues.filter((issue) => issue.status === "backlog");
  const sprintIssues = filteredIssues.filter((issue) => issue.status === "sprint");
  const inProgress = filteredIssues.filter((issue) => issue.status === "in_progress");
  const done = filteredIssues.filter((issue) => issue.status === "done");
  const released = filteredIssues.filter((issue) => issue.status === "released");

  const onSubmit = (event) => {
    event.preventDefault();
    setError("");
    if (
      !summary.trim() ||
      !description.trim() ||
      !acceptanceCriteria.trim() ||
      !issueType ||
      !priority
    ) {
      setError("Please fill all required fields.");
      return;
    }
    const submitIssue = async () => {
      if (isCreating) return;
      setIsCreating(true);
      if (editingId) {
        const { data: updated, error: updateError } = await supabase
          .from("issues")
          .update({
            summary: summary.trim(),
            description: description.trim(),
            acceptance_criteria: acceptanceCriteria.trim(),
            issue_type: issueType,
            priority,
            story_points: storyPoints ? Number(storyPoints) : null,
            start_date: startDate || null,
            due_date: dueDate || null,
            sprint: sprint.trim() || null
          })
          .eq("id", editingId)
          .select("*")
          .single();
        if (updateError) {
          setError(updateError.message);
          setIsCreating(false);
          return;
        }
        setIssues((prev) =>
          prev.map((issue) => (issue.id === editingId ? updated : issue))
        );
        resetForm();
        setIsCreating(false);
        return;
      }

      const { data, error: insertError } = await supabase
        .from("issues")
        .select("issue_key")
        .order("created_at", { ascending: false })
        .limit(1);
      if (insertError) {
        setError(insertError.message);
        setIsCreating(false);
        return;
      }
      const lastKey = data?.[0]?.issue_key ?? "";
      const nextKey = getNextIssueKey(lastKey, "APP");

      const { data: created, error: createError } = await supabase
        .from("issues")
        .insert([
          {
            issue_key: nextKey,
            summary: summary.trim(),
            description: description.trim(),
            acceptance_criteria: acceptanceCriteria.trim(),
            issue_type: issueType,
            priority,
            story_points: storyPoints ? Number(storyPoints) : null,
            start_date: startDate || null,
            due_date: dueDate || null,
            sprint: sprint.trim() || null,
            status: "backlog"
          }
        ])
        .select("*")
        .single();
      if (createError) {
        setError(createError.message);
        setIsCreating(false);
        return;
      }
      setIssues((prev) => [created, ...prev]);
      resetForm();
      setIsCreating(false);
    };
    submitIssue();
  };

  const moveIssue = (id, status) => {
    const updateIssue = async () => {
      const { data, error: updateError } = await supabase
        .from("issues")
        .update({ status })
        .eq("id", id)
        .select("*")
        .single();
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setIssues((prev) =>
        prev.map((issue) => (issue.id === id ? data : issue))
      );
    };
    updateIssue();
  };

  const onDragStart = (event, issueId, issueSummary) => {
    event.dataTransfer.setData("text/plain", issueId);
    event.dataTransfer.effectAllowed = "move";
    const ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.textContent = issueSummary || "Issue";
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 12, 12);
    setTimeout(() => ghost.remove(), 0);
  };

  const onDropColumn = (event, status) => {
    event.preventDefault();
    const issueId = event.dataTransfer.getData("text/plain");
    if (issueId) {
      moveIssue(issueId, status);
    }
    setDragStatus("");
  };

  const onDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const onDragEnter = (status) => {
    setDragStatus(status);
  };

  const onDragLeave = (event, status) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      if (dragStatus === status) setDragStatus("");
    }
  };

  const deleteIssue = (id) => {
    const removeIssue = async () => {
      const confirmed = window.confirm("Delete this issue? This cannot be undone.");
      if (!confirmed) return;
      const { error: deleteError } = await supabase
        .from("issues")
        .delete()
        .eq("id", id);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
      setIssues((prev) => prev.filter((issue) => issue.id !== id));
      if (editingId === id) {
        resetForm();
      }
    };
    removeIssue();
  };

  const startEdit = (issue) => {
    setEditingId(issue.id);
    setShowForm(true);
    setSummary(issue.summary ?? "");
    setDescription(issue.description ?? "");
    setAcceptanceCriteria(issue.acceptance_criteria ?? "");
    setIssueType(issue.issue_type ?? "Story");
    setPriority(issue.priority ?? "P2");
    setStoryPoints(
      issue.story_points === null || issue.story_points === undefined
        ? ""
        : String(issue.story_points)
    );
    setStartDate(issue.start_date ?? "");
    setDueDate(issue.due_date ?? "");
    setSprint(issue.sprint ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditingId(null);
    setShowForm(false);
    setSummary("");
    setDescription("");
    setAcceptanceCriteria("");
    setIssueType("Story");
    setPriority("P2");
    setStoryPoints("");
    setStartDate("");
    setDueDate("");
    setSprint("");
  };

  const copyIssue = async (issue) => {
    const confirmed = window.confirm("Do you want to duplicate the issue?");
    if (!confirmed) return;
    const { data, error: keyError } = await supabase
      .from("issues")
      .select("issue_key")
      .order("created_at", { ascending: false })
      .limit(1);
    if (keyError) {
      setError(keyError.message);
      return;
    }
    const lastKey = data?.[0]?.issue_key ?? "";
    const nextKey = getNextIssueKey(lastKey, "APP");
    const { data: created, error: createError } = await supabase
      .from("issues")
      .insert([
        {
          issue_key: nextKey,
          summary: issue.summary,
          description: issue.description,
          acceptance_criteria: issue.acceptance_criteria,
          issue_type: issue.issue_type,
          priority: issue.priority,
          story_points: issue.story_points,
          start_date: issue.start_date,
          due_date: issue.due_date,
          sprint: issue.sprint,
          status: issue.status ?? "backlog"
        }
      ])
      .select("*")
      .single();
    if (createError) {
      setError(createError.message);
      return;
    }
    setIssues((prev) => [created, ...prev]);
  };

  return (
    <main className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Jira Lite</p>
          <h1>Backlog to Sprint in one view.</h1>
          <p className="subhead">
            Create issues, set priority, and move work into sprint with a
            focused board.
          </p>
        </div>
        <div className="hero-card">
          <div className="metric">
            <span>Total Issues</span>
            <strong>{issues.length}</strong>
          </div>
          <div className="metric">
            <span>Backlog</span>
            <strong>{backlog.length}</strong>
          </div>
          <div className="metric">
            <span>In progress</span>
            <strong>{inProgress.length}</strong>
          </div>
          <div className="metric">
            <span>Sprint</span>
            <strong>{sprintIssues.length}</strong>
          </div>
          <div className="metric">
            <span>Done</span>
            <strong>{done.length}</strong>
          </div>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div className="tabs">
            <button
              type="button"
              className={activeTab === "board" ? "tab active" : "tab"}
              onClick={() => setActiveTab("board")}
            >
              <span className="tab-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M4 5h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-2 2-2-2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v8h5.2l1.8 1.8L12.8 15H20V7H4z" />
                </svg>
              </span>
              Board
            </button>
            <button
              type="button"
              className={activeTab === "sprint" ? "tab active" : "tab"}
              onClick={() => setActiveTab("sprint")}
            >
              Current Sprint
            </button>
          </div>
          <input
            className="search"
            placeholder="Search issues..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {activeTab === "board" && (
            <button
              type="button"
              className="primary sky"
              onClick={() => setShowForm((prev) => !prev)}
            >
              {showForm || editingId ? "Close Form" : "Create Issue"}
            </button>
          )}
        </div>
        {error && <div className="banner error">{error}</div>}
        {activeTab === "board" && (showForm || editingId) && (
          <form className="issue-form" onSubmit={onSubmit}>
            <label>
              Summary *
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Optional details or acceptance criteria"
                rows={3}
                required
              />
            </label>
            <label>
              Description *
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the issue in detail"
                rows={3}
                required
              />
            </label>
            <label>
              Acceptance Criteria *
              <textarea
                value={acceptanceCriteria}
                onChange={(event) => setAcceptanceCriteria(event.target.value)}
                placeholder="What needs to be true to accept this?"
                rows={3}
                required
              />
            </label>
            <label>
              Issue Type *
              <div className="priority-options">
                {ISSUE_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={type === issueType ? "chip active" : "chip"}
                    onClick={() => setIssueType(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </label>
            <label>
              Priority *
              <div className="priority-options">
                {PRIORITIES.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={level === priority ? "chip active" : "chip"}
                    onClick={() => setPriority(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </label>
            <label>
              Story Points (optional)
              <input
                type="number"
                min="0"
                value={storyPoints}
                onChange={(event) => setStoryPoints(event.target.value)}
                placeholder="e.g. 3"
              />
            </label>
            <label>
              Start Date (optional)
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label>
              Due Date (optional)
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
            <label>
              Sprint (optional)
              <input
                value={sprint}
                onChange={(event) => setSprint(event.target.value)}
                placeholder="Sprint 12"
              />
            </label>
            <button className="primary" type="submit">
              {isCreating
                ? editingId
                  ? "Saving..."
                  : "Creating..."
                : editingId
                  ? "Save Changes"
                  : "Create Issue"}
            </button>
            {editingId && (
              <button className="ghost" type="button" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
          </form>
        )}
      </section>

      {activeTab === "board" ? (
      <section className="board">
        <div
          className={dragStatus === "backlog" ? "column drop-active" : "column"}
          onDrop={(e) => onDropColumn(e, "backlog")}
          onDragOver={onDragOver}
          onDragEnter={() => onDragEnter("backlog")}
          onDragLeave={(e) => onDragLeave(e, "backlog")}
        >
          <div className="column-head">
            <h3>Backlog</h3>
            <span className="count">{backlog.length}</span>
          </div>
          <div className="stack">
            {isLoading && <LoadingState />}
            {backlog.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onMove={() => moveIssue(issue.id, "sprint")}
                onDelete={() => deleteIssue(issue.id)}
                onEdit={() => startEdit(issue)}
                onCopy={() => copyIssue(issue)}
                moveLabel="Move to Sprint"
                moveKind="sprint"
                onDragStart={(e) => onDragStart(e, issue.id, issue.summary)}
              />
            ))}
            {!isLoading && !backlog.length && (
              <EmptyState text="Backlog is clear. Add new issues to get started." />
            )}
          </div>
        </div>
        <div
          className={
            dragStatus === "sprint" ? "column accent drop-active" : "column accent"
          }
          onDrop={(e) => onDropColumn(e, "sprint")}
          onDragOver={onDragOver}
          onDragEnter={() => onDragEnter("sprint")}
          onDragLeave={(e) => onDragLeave(e, "sprint")}
        >
          <div className="column-head">
            <h3>Sprint</h3>
            <span className="count">{sprintIssues.length}</span>
          </div>
          <div className="stack">
            {isLoading && <LoadingState />}
            {sprintIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onMove={() => moveIssue(issue.id, "in_progress")}
                onDelete={() => deleteIssue(issue.id)}
                onEdit={() => startEdit(issue)}
                onCopy={() => copyIssue(issue)}
                moveLabel="Move to In progress"
                moveKind="default"
                onDragStart={(e) => onDragStart(e, issue.id, issue.summary)}
              />
            ))}
            {!isLoading && !sprintIssues.length && (
              <EmptyState text="Sprint is empty. Pull issues from backlog." />
            )}
          </div>
        </div>
        <div
          className={
            dragStatus === "in_progress"
              ? "column accent drop-active"
              : "column accent"
          }
          onDrop={(e) => onDropColumn(e, "in_progress")}
          onDragOver={onDragOver}
          onDragEnter={() => onDragEnter("in_progress")}
          onDragLeave={(e) => onDragLeave(e, "in_progress")}
        >
          <div className="column-head">
            <h3>In progress</h3>
            <span className="count">{inProgress.length}</span>
          </div>
          <div className="stack">
            {isLoading && <LoadingState />}
            {inProgress.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onMove={() => moveIssue(issue.id, "done")}
                onDelete={() => deleteIssue(issue.id)}
                onEdit={() => startEdit(issue)}
                onCopy={() => copyIssue(issue)}
                moveLabel="Move to Done"
                moveKind="default"
                onDragStart={(e) => onDragStart(e, issue.id, issue.summary)}
              />
            ))}
            {!isLoading && !inProgress.length && (
              <EmptyState text="In progress work shows here." />
            )}
          </div>
        </div>
        <div
          className={dragStatus === "done" ? "column drop-active" : "column"}
          onDrop={(e) => onDropColumn(e, "done")}
          onDragOver={onDragOver}
          onDragEnter={() => onDragEnter("done")}
          onDragLeave={(e) => onDragLeave(e, "done")}
        >
          <div className="column-head">
            <h3>Done</h3>
            <span className="count">{done.length}</span>
          </div>
          <div className="stack">
            {isLoading && <LoadingState />}
            {done.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onMove={() => moveIssue(issue.id, "backlog")}
                onDelete={() => deleteIssue(issue.id)}
                onEdit={() => startEdit(issue)}
                onCopy={() => copyIssue(issue)}
                moveLabel="Recycle to Backlog"
                moveKind="default"
                onDragStart={(e) => onDragStart(e, issue.id, issue.summary)}
              />
            ))}
            {!isLoading && !done.length && (
              <EmptyState text="No completed issues yet." />
            )}
          </div>
        </div>
      </section>
      ) : (
      <section className="board board-sprint">
        <div
          className={dragStatus === "sprint" ? "column drop-active" : "column"}
          onDrop={(e) => onDropColumn(e, "sprint")}
          onDragOver={onDragOver}
          onDragEnter={() => onDragEnter("sprint")}
          onDragLeave={(e) => onDragLeave(e, "sprint")}
        >
          <div className="column-head">
            <h3>Sprint Backlog</h3>
            <span className="count">{sprintIssues.length}</span>
          </div>
          <div className="stack">
            {isLoading && <LoadingState />}
            {sprintIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onMove={() => moveIssue(issue.id, "in_progress")}
                onDelete={() => deleteIssue(issue.id)}
                onEdit={() => startEdit(issue)}
                onCopy={() => copyIssue(issue)}
                moveLabel="Move to In progress"
                moveKind="default"
                onDragStart={(e) => onDragStart(e, issue.id, issue.summary)}
              />
            ))}
            {!isLoading && !sprintIssues.length && (
              <EmptyState text="Sprint backlog is empty." />
            )}
          </div>
        </div>
        <div
          className={
            dragStatus === "in_progress"
              ? "column accent drop-active"
              : "column accent"
          }
          onDrop={(e) => onDropColumn(e, "in_progress")}
          onDragOver={onDragOver}
          onDragEnter={() => onDragEnter("in_progress")}
          onDragLeave={(e) => onDragLeave(e, "in_progress")}
        >
          <div className="column-head">
            <h3>In progress</h3>
            <span className="count">{inProgress.length}</span>
          </div>
          <div className="stack">
            {isLoading && <LoadingState />}
            {inProgress.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onMove={() => moveIssue(issue.id, "done")}
                onDelete={() => deleteIssue(issue.id)}
                onEdit={() => startEdit(issue)}
                onCopy={() => copyIssue(issue)}
                moveLabel="Move to Done"
                moveKind="default"
                onDragStart={(e) => onDragStart(e, issue.id, issue.summary)}
              />
            ))}
            {!isLoading && !inProgress.length && (
              <EmptyState text="No in-progress issues yet." />
            )}
          </div>
        </div>
        <div
          className={dragStatus === "done" ? "column drop-active" : "column"}
          onDrop={(e) => onDropColumn(e, "done")}
          onDragOver={onDragOver}
          onDragEnter={() => onDragEnter("done")}
          onDragLeave={(e) => onDragLeave(e, "done")}
        >
          <div className="column-head">
            <h3>Done</h3>
            <span className="count">{done.length}</span>
          </div>
          <div className="stack">
            {isLoading && <LoadingState />}
            {done.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onMove={() => moveIssue(issue.id, "released")}
                onDelete={() => deleteIssue(issue.id)}
                onEdit={() => startEdit(issue)}
                onCopy={() => copyIssue(issue)}
                moveLabel="Move to Released"
                moveKind="default"
                onDragStart={(e) => onDragStart(e, issue.id, issue.summary)}
              />
            ))}
            {!isLoading && !done.length && (
              <EmptyState text="No done issues yet." />
            )}
          </div>
        </div>
        <div
          className={dragStatus === "released" ? "column drop-active" : "column"}
          onDrop={(e) => onDropColumn(e, "released")}
          onDragOver={onDragOver}
          onDragEnter={() => onDragEnter("released")}
          onDragLeave={(e) => onDragLeave(e, "released")}
        >
          <div className="column-head">
            <h3>Released</h3>
            <span className="count">{released.length}</span>
          </div>
          <div className="stack">
            {isLoading && <LoadingState />}
            {released.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onMove={() => moveIssue(issue.id, "sprint")}
                onDelete={() => deleteIssue(issue.id)}
                onEdit={() => startEdit(issue)}
                onCopy={() => copyIssue(issue)}
                moveLabel="Recycle to Sprint Backlog"
                moveKind="default"
                onDragStart={(e) => onDragStart(e, issue.id, issue.summary)}
              />
            ))}
            {!isLoading && !released.length && (
              <EmptyState text="No released issues yet." />
            )}
          </div>
        </div>
      </section>
      )}
    </main>
  );
}

function IssueCard({ issue, onMove, onDelete, onEdit, onCopy, moveLabel, moveKind, onDragStart }) {
  return (
    <article className="issue-card" draggable onDragStart={onDragStart}>
          <div className="issue-top">
            <div>
          <h4>{issue.summary}</h4>
            </div>
        <span className={`pill ${issue.priority.toLowerCase()}`}>
          {issue.priority}
        </span>
      </div>
      <div className="issue-meta">
        <span className="tag">{issue.issue_key}</span>
        <span className="tag">{issue.issue_type}</span>
        {issue.sprint && <span className="tag">Sprint: {issue.sprint}</span>}
        {issue.story_points !== null && (
          <span className="tag">SP: {issue.story_points}</span>
        )}
        {issue.start_date && <span className="tag">Start: {issue.start_date}</span>}
        {issue.due_date && <span className="tag">Due: {issue.due_date}</span>}
      </div>
      <div className="issue-notes">
        <div>
          <strong>Description</strong>
          <p>{issue.description}</p>
        </div>
        <div>
          <strong>Acceptance Criteria</strong>
          <p>{issue.acceptance_criteria}</p>
        </div>
      </div>
      <div className="issue-actions">
        <button
          className="icon-button"
          type="button"
          onClick={onEdit}
          aria-label="Edit issue"
          title="Edit"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 20h4l11-11-4-4L4 16v4zm14-14 2 2 1-1a1.5 1.5 0 0 0 0-2l-1-1a1.5 1.5 0 0 0-2 0l-1 1 1 1z" />
          </svg>
        </button>
        <button
          className={moveKind === "sprint" ? "icon-button success" : "icon-button"}
          type="button"
          onClick={onMove}
          aria-label={moveLabel}
          title={moveLabel}
        >
          {moveKind === "sprint" ? (
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M13 4.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zm5 6.4-4.6 1.4-2.2 3.8 2.4 1.6-1.1 2.3-2.7-1.3-2.9-2.2-2.7 4.2H1.8l3.1-5.9-1.9-3.2 2.4-1.4 1.6 2.6 3.3 2.2 1.3-2.3-2.4-1.6 1.4-2.4 5.6-1.7 2.2 2.5z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M14.5 3c-3.6 1.2-6.7 4.2-7.9 7.9L3 14.5l6.6 1.9L11.5 21l3.6-3.6c3.7-1.2 6.7-4.3 7.9-7.9L14.5 3zm-4.2 10.2a2.3 2.3 0 1 1 3.2-3.2 2.3 2.3 0 0 1-3.2 3.2zM5 19l1-3 3 3-3 1-1-1z" />
            </svg>
          )}
        </button>
        <button
          className="icon-button danger"
          type="button"
          onClick={onDelete}
          aria-label="Delete issue"
          title="Delete"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M7 9h2v9H7V9zm4 0h2v9h-2V9zm4 0h2v9h-2V9zM6 6h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 6zm3-3h6l1 2H8l1-2z" />
          </svg>
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={onCopy}
          aria-label="Copy issue"
          title="Copy"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M7 3h10a2 2 0 0 1 2 2v10h-2V5H7V3zm-2 4h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm0 2v10h10V9H5z" />
          </svg>
        </button>
      </div>
    </article>
  );
}

function EmptyState({ text }) {
  return (
    <div className="empty">
      <span>{text}</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="empty">
      <span>Loading issues…</span>
    </div>
  );
}

function getNextIssueKey(lastKey, prefix) {
  const match = new RegExp(`^${prefix}-(\\d+)$`).exec(lastKey);
  const nextNumber = match ? Number(match[1]) + 1 : 1;
  const padded = String(nextNumber).padStart(4, "0");
  return `${prefix}-${padded}`;
}
