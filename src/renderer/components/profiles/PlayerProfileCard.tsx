import React, { useState } from "react";
import Button from "../common/Button";
import Input from "../common/Input";
import styles from "./PlayerProfileCard.module.css";
import type { PlayerProfile } from "../../../shared/types";

type PlayerProfileCardProps = {
  profile: PlayerProfile;
  onUpdate: (id: string, nickname: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
};

const PlayerProfileCard = ({
  profile,
  onUpdate,
  onRemove
}: PlayerProfileCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState(profile.nickname);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (nickname.trim() === profile.nickname) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onUpdate(profile.id, nickname.trim());
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNickname(profile.nickname);
    setError(null);
    setIsEditing(false);
  };

  const handleRemove = async () => {
    if (!confirm(`Are you sure you want to remove "${profile.nickname}"?`)) {
      return;
    }

    setIsRemoving(true);
    setError(null);
    try {
      await onRemove(profile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove profile");
    } finally {
      setIsRemoving(false);
    }
  };

  if (isEditing) {
    return (
      <div className={styles.card}>
        <Input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          error={error || undefined}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSave();
            } else if (e.key === "Escape") {
              handleCancel();
            }
          }}
        />
        <div className={styles.actions}>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !nickname.trim()}
          >
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.content}>
        <span className={styles.nickname}>{profile.nickname}</span>
      </div>
      <div className={styles.actions}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(true)}
          disabled={isRemoving}
        >
          Edit
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={handleRemove}
          disabled={isRemoving}
        >
          Remove
        </Button>
      </div>
      {error && !isEditing && <div className={styles.error}>{error}</div>}
    </div>
  );
};

export default PlayerProfileCard;
