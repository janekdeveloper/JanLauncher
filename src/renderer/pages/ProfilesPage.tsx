import React, { useEffect, useState } from "react";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import Modal from "../components/common/Modal";
import PlayerProfileCard from "../components/profiles/PlayerProfileCard";
import { useProfilesStore } from "../store/profilesStore";
import styles from "./ProfilesPage.module.css";

const ProfilesPage = () => {
  const {
    playerProfiles,
    playerProfilesLoading,
    playerProfilesError,
    loadPlayerProfiles,
    createPlayerProfile,
    updatePlayerProfile,
    removePlayerProfile
  } = useProfilesStore();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadPlayerProfiles();
  }, [loadPlayerProfiles]);

  const handleCreate = async () => {
    const trimmed = newNickname.trim();
    if (!trimmed) {
      setCreateError("Nickname cannot be empty");
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      await createPlayerProfile(trimmed);
      setNewNickname("");
      setIsCreateModalOpen(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create profile");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCloseModal = () => {
    setNewNickname("");
    setCreateError(null);
    setIsCreateModalOpen(false);
  };

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Player Profiles</h2>
          <p className={styles.subtitle}>Manage your player profiles</p>
        </div>
        <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
          Create Profile
        </Button>
      </div>

      {playerProfilesError && (
        <div className={styles.errorBanner}>
          <span>{playerProfilesError}</span>
          <Button variant="ghost" size="sm" onClick={loadPlayerProfiles}>
            Retry
          </Button>
        </div>
      )}

      {playerProfilesLoading ? (
        <div className={styles.loading}>Loading profiles...</div>
      ) : playerProfiles.length === 0 ? (
        <div className={styles.empty}>
          <p>No player profiles yet</p>
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            Create your first profile
          </Button>
        </div>
      ) : (
        <div className={styles.grid}>
          {playerProfiles.map((profile) => (
            <PlayerProfileCard
              key={profile.id}
              profile={profile}
              onUpdate={updatePlayerProfile}
              onRemove={removePlayerProfile}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseModal}
        title="Create Player Profile"
      >
        <div className={styles.modalContent}>
          <Input
            label="Nickname"
            value={newNickname}
            onChange={(e) => {
              setNewNickname(e.target.value);
              setCreateError(null);
            }}
            error={createError || undefined}
            placeholder="Enter nickname"
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
              disabled={isCreating || !newNickname.trim()}
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

export default ProfilesPage;
