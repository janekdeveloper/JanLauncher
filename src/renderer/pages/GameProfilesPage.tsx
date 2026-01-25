import React, { useEffect, useState } from "react";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import Modal from "../components/common/Modal";
import GameProfileCard from "../components/profiles/GameProfileCard";
import { useProfilesStore } from "../store/profilesStore";
import styles from "./GameProfilesPage.module.css";

const GameProfilesPage = () => {
  const {
    gameProfiles,
    gameProfilesLoading,
    gameProfilesError,
    loadGameProfiles,
    createGameProfile,
    updateGameProfile,
    removeGameProfile
  } = useProfilesStore();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadGameProfiles();
  }, [loadGameProfiles]);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setCreateError("Game profile name cannot be empty");
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      await createGameProfile(trimmed);
      setNewName("");
      setIsCreateModalOpen(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create profile");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCloseModal = () => {
    setNewName("");
    setCreateError(null);
    setIsCreateModalOpen(false);
  };

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Game Profiles</h2>
          <p className={styles.subtitle}>Manage your game profiles and mods</p>
        </div>
        <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
          Create Profile
        </Button>
      </div>

      {gameProfilesError && (
        <div className={styles.errorBanner}>
          <span>{gameProfilesError}</span>
          <Button variant="ghost" size="sm" onClick={loadGameProfiles}>
            Retry
          </Button>
        </div>
      )}

      {gameProfilesLoading ? (
        <div className={styles.loading}>Loading profiles...</div>
      ) : gameProfiles.length === 0 ? (
        <div className={styles.empty}>
          <p>No game profiles yet</p>
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            Create your first profile
          </Button>
        </div>
      ) : (
        <div className={styles.grid}>
          {gameProfiles.map((profile) => (
            <GameProfileCard
              key={profile.id}
              profile={profile}
              onUpdate={updateGameProfile}
              onRemove={removeGameProfile}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseModal}
        title="Create Game Profile"
      >
        <div className={styles.modalContent}>
          <Input
            label="Profile Name"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setCreateError(null);
            }}
            error={createError || undefined}
            placeholder="Enter profile name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCreate();
              } else if (e.key === "Escape") {
                handleCloseModal();
              }
            }}
          />
          <div className={styles.modalActions}>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={isCreating || !newName.trim()}
            >
              Create
            </Button>
            <Button variant="ghost" onClick={handleCloseModal} disabled={isCreating}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
};

export default GameProfilesPage;
