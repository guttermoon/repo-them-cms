"use client"

import { createContext, type ReactNode, useContext, useEffect, useId, useMemo, useState } from "react"

import { matches, queryWords } from "@/lib/search"

/**
 * Search, in the site's field (a pill, `.field`): an icon, the words typed
 * in the mono face, and the count found below it. It filters a
 * list already on the page, so it works without a request and without
 * JavaScript the whole list simply stays.
 *
 * The field is labelled (hidden), is a real search field (Escape clears it,
 * the keyboard's search key submits nothing), and the count is told to a
 * screen reader as it changes. The words are kept in the address (?q=), so
 * a search can be shared or come back to.
 */
export type SearchLabels = { label: string; placeholder: string; found: string; none: string }

const SearchContext = createContext<{ words: string[] } | null>(null)

/** The query in the address when the page loads, and kept there as it changes. */
export function useAddressQuery(): [string, (q: string) => void] {
  const [query, setQuery] = useState("")
  useEffect(() => {
    setQuery(new URLSearchParams(window.location.search).get("q") ?? "")
  }, [])
  const update = (q: string) => {
    setQuery(q)
    const url = new URL(window.location.href)
    if (q.trim()) url.searchParams.set("q", q)
    else url.searchParams.delete("q")
    window.history.replaceState(window.history.state, "", url)
  }
  return [query, update]
}

/** The search field itself, given the query and told when it changes. */
export function SearchField({
  query,
  onQuery,
  labels,
  count,
  icon,
}: {
  query: string
  onQuery: (q: string) => void
  labels: SearchLabels
  /** how many items the query finds, or undefined with no query */
  count?: number
  /** drawn on the server and handed in (components/ui/icon) */
  icon?: ReactNode
}) {
  const id = useId()
  const searching = query.trim() !== "" && count !== undefined
  return (
    <div role="search" className="w-full">
      <div className="field flex items-center gap-3">
        {icon ? <span className="flex text-lead text-sub">{icon}</span> : null}
        <label htmlFor={id} className="sr-only">
          {labels.label}
        </label>
        <input
          id={id}
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={labels.placeholder}
          autoComplete="off"
          spellCheck={false}
          className="min-h-target min-w-0 flex-1 placeholder:text-sub"
        />
      </div>
      <p role="status" aria-live="polite" className={searching ? "mt-3 px-4 text-small text-sub" : "sr-only"}>
        {searching ? (count ? `${count} ${labels.found}` : labels.none) : ""}
      </p>
    </div>
  )
}

/**
 * A list searched in place: the field above, and each SearchItem inside
 * shown or hidden by its own words. The items are drawn on the server; only
 * their words come here.
 */
export function SearchList({ labels, icon, total, texts, children }: { labels: SearchLabels; icon?: ReactNode; total: number; texts: string[]; children: ReactNode }) {
  const [query, setQuery] = useAddressQuery()
  const words = useMemo(() => queryWords(query), [query])
  const count = words.length ? texts.filter((text) => matches(text, words)).length : undefined
  return (
    <SearchContext.Provider value={{ words }}>
      <div className="mb-8 max-w-[560px]">
        <SearchField query={query} onQuery={setQuery} labels={labels} count={count} icon={icon} />
      </div>
      {total ? children : null}
    </SearchContext.Provider>
  )
}

/** One item of a SearchList: hidden while the query does not find its words. */
export function SearchItem({ text, children }: { text: string; children: ReactNode }) {
  const search = useContext(SearchContext)
  const shown = !search || matches(text, search.words)
  // `contents` keeps the card itself the grid's item; display:none hides it
  // (the hidden attribute would lose to `contents`, which sets display too)
  return <div className={shown ? "contents" : "hidden"}>{children}</div>
}
