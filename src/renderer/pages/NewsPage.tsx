import { useEffect, useState, useRef } from "react";
import { api } from "../services/api";
import { useI18n } from "../i18n";
import { ExternalLinkIcon } from "../components/icons";
import type { NewsArticle } from "../../shared/types";
import styles from "./NewsPage.module.css";

const NewsPage = () => {
  const { t, language } = useI18n();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isLoadingRef.current) {
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);
    
    abortControllerRef.current = new AbortController();
    const abortSignal = abortControllerRef.current.signal;

    const loadNews = async () => {
      try {
        const cachedNews = await api.news.loadCached(language);
        if (abortSignal.aborted) return;
        
        if (cachedNews && cachedNews.length > 0) {
          setArticles(cachedNews);
          setIsLoading(false);
        }

        try {
          const freshNews = await api.news.refresh(language);
          if (abortSignal.aborted) return;
          setArticles(freshNews);
        } catch (refreshError) {
          if (abortSignal.aborted) return;
          if (!cachedNews || cachedNews.length === 0) {
            setError(t("news.loadError"));
          }
        }
      } catch {
        if (abortSignal.aborted) return;
        setError(t("news.loadError"));
      } finally {
        if (!abortSignal.aborted) {
          setIsLoading(false);
          isLoadingRef.current = false;
        }
      }
    };

    loadNews();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      isLoadingRef.current = false;
    };
  }, [language]);

  const handleOpenArticle = async (url: string) => {
    try {
      await api.news.openUrl(url);
    } catch {
    }
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return t("news.recently");
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return t("news.oneDayAgo");
      if (diffDays < 7) return t("news.daysAgo", { count: diffDays });
      if (diffDays < 30) {
        const weeks = Math.ceil(diffDays / 7);
        return t("news.weeksAgo", { count: weeks });
      }
      return date.toLocaleDateString();
    } catch {
      return t("news.recently");
    }
  };

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t("news.title")}</h2>
          <p className={styles.subtitle}>{t("news.subtitle")}</p>
        </div>
      </div>

      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.loading}>{t("news.loading")}</div>
        ) : error ? (
          <div className={styles.error}>
            <p>{error}</p>
          </div>
        ) : articles.length === 0 ? (
          <div className={styles.empty}>
            <h4>{t("news.noNews")}</h4>
            <p>{t("news.noNewsHint")}</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {articles.map((article, index) => (
              <article
                key={index}
                className={`${styles.card} listItemEnter`}
                style={{ animationDelay: `${Math.min(index, 7) * 40}ms` }}
              >
                {article.imageUrl && (
                  <div
                    className={styles.cardImage}
                    style={{ backgroundImage: `url(${article.imageUrl})` }}
                  />
                )}
                <div className={styles.cardContent}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>{article.title}</h3>
                    {article.date && (
                      <span className={styles.cardDate}>
                        {formatDate(article.date)}
                      </span>
                    )}
                  </div>
                  {article.description && (
                    <p className={styles.cardDescription}>
                      {article.description}
                    </p>
                  )}
                  {article.destUrl && (
                    <button
                      type="button"
                      className={styles.cardButton}
                      onClick={() => handleOpenArticle(article.destUrl)}
                      aria-label={t("news.openArticle")}
                    >
                      <ExternalLinkIcon className={styles.cardButtonIcon} />
                      <span>{t("news.readMore")}</span>
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default NewsPage;
