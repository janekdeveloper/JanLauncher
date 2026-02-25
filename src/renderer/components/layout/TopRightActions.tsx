import { useNavigate } from "react-router-dom";
import { InfoCircleIcon } from "../icons";
import styles from "./TopRightActions.module.css";

const TopRightActions = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.aboutButton}
        onClick={() => navigate("/about")}
        aria-label="About"
      >
        <InfoCircleIcon className={styles.aboutIcon} />
      </button>
    </div>
  );
};

export default TopRightActions;
