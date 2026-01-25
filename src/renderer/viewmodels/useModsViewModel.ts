import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../services/api";
import { useLauncherStore } from "../store/launcherStore";
import { useI18n } from "../i18n/I18nContext";
import type { CurseForgeMod, Mod } from "../../shared/types";

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

export const useModsViewModel = () => {
  const { selectedGame } = useLauncherStore();
  const { language } = useI18n();
  const [query, setQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<ModFilter>(MOD_FILTERS[0]);
  const [searchResults, setSearchResults] = useState<CurseForgeMod[]>([]);
  const [installedMods, setInstalledMods] = useState<Mod[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingInstalled, setIsLoadingInstalled] = useState(false);
  const [installingModId, setInstallingModId] = useState<number | null>(null);
  const [togglingModId, setTogglingModId] = useState<string | null>(null);
  const [uninstallingModId, setUninstallingModId] = useState<string | null>(null);
  const [searchPageIndex, setSearchPageIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(20);
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchParamsRef = useRef<{
    query: string;
    filter: ModFilter;
    pageIndex: number;
  } | null>(null);

  useEffect(() => {
    if (!selectedGame?.id) {
      setInstalledMods([]);
      return;
    }

    const loadInstalled = async () => {
      setIsLoadingInstalled(true);
      try {
        const mods = await api.mods.loadInstalled(selectedGame.id, language);
        setInstalledMods(mods);
      } catch {
      } finally {
        setIsLoadingInstalled(false);
      }
    };

    loadInstalled();
  }, [selectedGame?.id, language]);

  const searchMods = useCallback(
    async (searchQuery: string, pageIndex = 0, filter: ModFilter = selectedFilter) => {
      setIsSearching(true);
      try {
        const result = await api.mods.search({
          query: searchQuery,
          pageIndex,
          pageSize,
          sortField: filter.sortField,
          sortOrder: filter.sortOrder,
          language
        });

        setSearchResults(result.data);
        
        const total = result.pagination.totalCount;
        const calculatedTotalPages = Math.ceil(total / pageSize);
        setTotalPages(calculatedTotalPages > 0 ? calculatedTotalPages : 1);
        setSearchPageIndex(pageIndex);
        lastSearchParamsRef.current = { 
          query: searchQuery, 
          filter: { ...filter }, 
          pageIndex 
        };
      } catch {
      } finally {
        setIsSearching(false);
      }
    },
    [selectedFilter, language]
  );

  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      const searchQuery = query.trim();
      
      const lastParams = lastSearchParamsRef.current;
      if (
        lastParams &&
        lastParams.query === searchQuery &&
        lastParams.filter.sortField === selectedFilter.sortField &&
        lastParams.filter.sortOrder === selectedFilter.sortOrder &&
        lastParams.pageIndex === 0
      ) {
        return;
      }

      searchMods(searchQuery, 0, selectedFilter);
    }, 500);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [query, selectedFilter, searchMods]);

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
          if (existing) {
            return prev.map((m) => (m.id === installedMod.id ? installedMod : m));
          }
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
        await api.mods.toggle({
          gameProfileId: selectedGame.id,
          modId
        });

        setInstalledMods((prev) =>
          prev.map((mod) =>
            mod.id === modId ? { ...mod, enabled: !mod.enabled } : mod
          )
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
        await api.mods.uninstall({
          gameProfileId: selectedGame.id,
          modId
        });

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
    (modId: number): boolean => {
      return installedMods.some((mod) => mod.curseForgeId === modId);
    },
    [installedMods]
  );

  const goToPage = useCallback((page: number) => {
    if (!isSearching && page >= 0 && page < totalPages) {
      searchMods(query.trim(), page, selectedFilter);
    }
  }, [isSearching, totalPages, query, selectedFilter, searchMods]);

  const nextPage = useCallback(() => {
    if (searchPageIndex < totalPages - 1) {
      goToPage(searchPageIndex + 1);
    }
  }, [searchPageIndex, totalPages, goToPage]);

  const prevPage = useCallback(() => {
    if (searchPageIndex > 0) {
      goToPage(searchPageIndex - 1);
    }
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
    openModUrl
  };
};
