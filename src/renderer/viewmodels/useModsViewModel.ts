import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../services/api";
import { useLauncherStore } from "../store/launcherStore";
import { useI18n } from "../i18n/I18nContext";
import type { CurseForgeCategory, CurseForgeMod, Mod } from "../../shared/types";

export type ModSortField = "downloads" | "dateCreated" | "dateModified" | "name";
export type ModSortOrder = "asc" | "desc";

export type ModFilter = {
  sortField: ModSortField;
  sortOrder: ModSortOrder;
  label: string;
};

export const MOD_FILTERS: ModFilter[] = [
  { sortField: "downloads", sortOrder: "desc", label: "mostPopular" },
  { sortField: "downloads", sortOrder: "asc", label: "leastPopular" },
  { sortField: "dateCreated", sortOrder: "desc", label: "newest" },
  { sortField: "dateCreated", sortOrder: "asc", label: "oldest" }
];

const DEBOUNCE_MS = 400;
const PAGE_SIZE = 20;

type SearchParams = {
  query: string;
  filter: ModFilter;
  pageIndex: number;
  categoryId: number | null;
  gameVersion: string | null;
};

const defaultSearchParams = (): SearchParams => ({
  query: "",
  filter: MOD_FILTERS[0],
  pageIndex: 0,
  categoryId: null,
  gameVersion: null
});

export const useModsViewModel = () => {
  const { selectedGame } = useLauncherStore();
  const { language } = useI18n();

  const [query, setQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<ModFilter>(MOD_FILTERS[0]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedGameVersion, setSelectedGameVersion] = useState<string | null>(null);
  const [categories, setCategories] = useState<CurseForgeCategory[]>([]);
  const [gameVersions, setGameVersions] = useState<string[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);

  const [searchResults, setSearchResults] = useState<CurseForgeMod[]>([]);
  const [installedMods, setInstalledMods] = useState<Mod[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingInstalled, setIsLoadingInstalled] = useState(false);
  const [installingModId, setInstallingModId] = useState<number | null>(null);
  const [togglingModId, setTogglingModId] = useState<string | null>(null);
  const [uninstallingModId, setUninstallingModId] = useState<string | null>(null);
  const [searchPageIndex, setSearchPageIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestIdRef = useRef(0);
  const lastSearchParamsRef = useRef<SearchParams | null>(null);

  useEffect(() => {
    if (!selectedGame?.id) {
      setInstalledMods([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setIsLoadingInstalled(true);
      try {
        const mods = await api.mods.loadInstalled(selectedGame.id, language);
        if (cancelled) return;
        setInstalledMods(mods);
        const needsEnrich = mods.some((m) => typeof m.curseForgeId === "number" && !m.iconUrl);
        if (needsEnrich) {
          try {
            await api.mods.enrichProfileModIcons(selectedGame.id);
            if (cancelled) return;
            const updated = await api.mods.loadInstalled(selectedGame.id, language);
            if (!cancelled) setInstalledMods(updated);
          } catch {
            // keep current mods on enrich failure
          }
        }
      } catch {
      } finally {
        if (!cancelled) setIsLoadingInstalled(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedGame?.id, language]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoadingFilters(true);
      try {
        const [cats, vers] = await Promise.all([
          api.mods.getCategories(language),
          api.mods.getGameVersions()
        ]);
        if (!cancelled) {
          setCategories(cats ?? []);
          setGameVersions(vers ?? []);
        }
      } catch {
        if (!cancelled) {
          setCategories([]);
          setGameVersions([]);
        }
      } finally {
        if (!cancelled) setIsLoadingFilters(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [language]);

  const runSearch = useCallback(
    async (overrides?: Partial<SearchParams>) => {
      const q = overrides?.query ?? query;
      const filter = overrides?.filter ?? selectedFilter;
      const pageIndex = overrides?.pageIndex ?? searchPageIndex;
      const categoryId = overrides?.categoryId !== undefined ? overrides.categoryId : selectedCategoryId;
      const gameVersion = overrides?.gameVersion !== undefined ? overrides.gameVersion : selectedGameVersion;

      const params: SearchParams = { query: q, filter, pageIndex, categoryId: categoryId ?? null, gameVersion: gameVersion ?? null };

      const last = lastSearchParamsRef.current;
      if (
        last &&
        last.query === params.query &&
        last.filter.sortField === params.filter.sortField &&
        last.filter.sortOrder === params.filter.sortOrder &&
        last.pageIndex === params.pageIndex &&
        last.categoryId === params.categoryId &&
        last.gameVersion === params.gameVersion
      ) {
        return;
      }

      const requestId = ++searchRequestIdRef.current;
      lastSearchParamsRef.current = { ...params };

      setIsSearching(true);
      try {
        const result = await api.mods.search({
          query: params.query.trim(),
          pageIndex: params.pageIndex,
          pageSize: PAGE_SIZE,
          sortField: params.filter.sortField,
          sortOrder: params.filter.sortOrder,
          categoryId: params.categoryId ?? undefined,
          gameVersion: params.gameVersion ?? undefined,
          language
        });

        if (requestId !== searchRequestIdRef.current) return;

        setSearchResults(result.data);
        const total = result.pagination.totalCount;
        const calculatedTotalPages = Math.ceil(total / PAGE_SIZE);
        setTotalPages(calculatedTotalPages > 0 ? calculatedTotalPages : 1);
        setSearchPageIndex(params.pageIndex);
      } catch {
        if (requestId !== searchRequestIdRef.current) return;
        setSearchResults([]);
        setTotalPages(1);
        setSearchPageIndex(0);
      } finally {
        if (requestId === searchRequestIdRef.current) setIsSearching(false);
      }
    },
    [query, selectedFilter, selectedCategoryId, selectedGameVersion, searchPageIndex, language]
  );

  useEffect(() => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      runSearch({ pageIndex: 0 });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    runSearch({ pageIndex: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilter, selectedCategoryId, selectedGameVersion]);

  const resetSearchState = useCallback(() => {
    setQuery("");
    setSelectedCategoryId(null);
    setSelectedGameVersion(null);
    setSelectedFilter(MOD_FILTERS[0]);
    setSearchPageIndex(0);
    lastSearchParamsRef.current = null;
    runSearch({
      query: "",
      categoryId: null,
      gameVersion: null,
      filter: MOD_FILTERS[0],
      pageIndex: 0
    });
  }, [runSearch]);

  const installMod = useCallback(
    async (modId: number, fileId?: number) => {
      if (!selectedGame?.id) return;
      setInstallingModId(modId);
      try {
        const installedMod = await api.mods.install({
          gameProfileId: selectedGame.id,
          modId,
          fileId
        });
        setInstalledMods((prev) => {
          const existing = prev.find((m) => m.id === installedMod.id);
          if (existing) return prev.map((m) => (m.id === installedMod.id ? installedMod : m));
          return [...prev, installedMod];
        });
      } catch (error) {
        throw error;
      } finally {
        setInstallingModId(null);
      }
    },
    [selectedGame?.id]
  );

  const toggleMod = useCallback(
    async (modId: string) => {
      if (!selectedGame?.id) return;
      setTogglingModId(modId);
      try {
        await api.mods.toggle({ gameProfileId: selectedGame.id, modId });
        setInstalledMods((prev) =>
          prev.map((mod) => (mod.id === modId ? { ...mod, enabled: !mod.enabled } : mod))
        );
      } catch (error) {
        throw error;
      } finally {
        setTogglingModId(null);
      }
    },
    [selectedGame?.id]
  );

  const uninstallMod = useCallback(
    async (modId: string) => {
      if (!selectedGame?.id) return;
      setUninstallingModId(modId);
      try {
        await api.mods.uninstall({ gameProfileId: selectedGame.id, modId });
        setInstalledMods((prev) => prev.filter((mod) => mod.id !== modId));
      } catch (error) {
        throw error;
      } finally {
        setUninstallingModId(null);
      }
    },
    [selectedGame?.id]
  );

  const isModInstalled = useCallback(
    (modId: number): boolean => installedMods.some((mod) => mod.curseForgeId === modId),
    [installedMods]
  );

  const goToPage = useCallback(
    (page: number) => {
      if (isSearching || page < 0 || page >= totalPages) return;
      runSearch({ pageIndex: page });
    },
    [isSearching, totalPages, runSearch]
  );

  const nextPage = useCallback(() => {
    if (searchPageIndex < totalPages - 1) goToPage(searchPageIndex + 1);
  }, [searchPageIndex, totalPages, goToPage]);

  const prevPage = useCallback(() => {
    if (searchPageIndex > 0) goToPage(searchPageIndex - 1);
  }, [searchPageIndex, goToPage]);

  const openModUrl = useCallback(async (mod: CurseForgeMod) => {
    try {
      let url: string;
      if (mod.websiteUrl && mod.websiteUrl.includes("curseforge.com")) {
        url = mod.websiteUrl;
      } else if (mod.slug) {
        url = `https://www.curseforge.com/hytale/mods/${mod.slug}`;
      } else {
        url = `https://www.curseforge.com/hytale/mods/${mod.id}`;
      }
      await api.mods.openUrl(url);
    } catch (error) {
      console.error("Failed to open mod URL:", error);
    }
  }, []);

  return {
    selectedGame,
    query,
    setQuery,
    selectedFilter,
    setSelectedFilter,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedGameVersion,
    setSelectedGameVersion,
    categories,
    gameVersions,
    isLoadingFilters,
    filters: MOD_FILTERS,
    searchResults,
    installedMods,
    isSearching,
    isLoadingInstalled,
    installingModId,
    togglingModId,
    uninstallingModId,
    searchPageIndex,
    totalPages,
    currentPage: searchPageIndex + 1,
    goToPage,
    nextPage,
    prevPage,
    installMod,
    toggleMod,
    uninstallMod,
    isModInstalled,
    openModUrl,
    resetSearchState
  };
};
