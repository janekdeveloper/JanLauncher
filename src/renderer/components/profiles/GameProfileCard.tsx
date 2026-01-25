import React, { useState } from "react";
import Button from "../common/Button";
import Input from "../common/Input";
import styles from "./GameProfileCard.module.css";
import type { GameProfile } from "../../../shared/types";

type GameProfileCardProps = {
  profile: GameProfile;
  onUpdate: (id: string, patch: Partial<GameProfile>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
};

const GameProfileCard = ({
  profile,
  onUpdate,
  onRemove
}: GameProfileCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (name.trim() === profile.name) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onUpdate(profile.id, { name: name.trim() });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setName(profile.name);
    setError(null);
    setIsEditing(false);
  };

  const handleRemove = async () => {
    if (!confirm(`Are you sure you want to remove "${profile.name}"?`)) {
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
          value={name}
          onChange={(e) => setName(e.target.value)}
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
            disabled={isSaving || !name.trim()}
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
        <div className={styles.info}>
          <span className={styles.name}>{profile.name}</span>
          <div className={styles.meta}>
            <span className={styles.modsCount}>{profile.mods.length} mods</span>
            {profile.javaPath && (
              <span className={styles.javaPath}>{profile.javaPath}</span>
            )}
          </div>
        </div>
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

export default GameProfileCard;
