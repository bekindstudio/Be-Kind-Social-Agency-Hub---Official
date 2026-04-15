# Standard fetch dati — Agency Portal

## Regola principale
Ogni chiamata API usa React Query.
Hook Orval generati se disponibili,
`useQuery`/`useMutation` altrimenti.

## Pattern query standard
```ts
const { data, isLoading, error } = useQuery({
  queryKey: ["dominio", "risorsa", id, filtri],
  queryFn: () =>
    portalFetch(`/api/endpoint`)
      .then((r) => r.json()),
  staleTime: 5 * 60 * 1000,   // 5 minuti default
  gcTime: 30 * 60 * 1000,     // 30 minuti in cache
  retry: 2,
  enabled: !!requiredParam
})
```

## Pattern mutation standard
```ts
const mutation = useMutation({
  mutationFn: (data) =>
    portalFetch("/api/endpoint", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    }).then((r) => r.json()),
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: ["dominio"]
    })
    toast.success("Salvato")
  },
  onError: (err) => {
    toast.error(
      err.message ?? "Qualcosa è andato storto"
    )
  }
})
```

## Namespace query keys
Ogni dominio ha il suo prefisso:
- `["clients", clientId, ...]`
- `["tasks", taskId, ...]`
- `["editorial", clientId, ...]`
- `["analytics", clientId, period]`
- `["reports", clientId, ...]`
- `["competitors", clientId, ...]`
- `["events", clientId, ...]`
- `["ai", ...]`
- `["meta", ...]`

## staleTime per tipo di dato
- Dati che cambiano spesso (task, post): 2 min
- Dati medi (report, analytics): 5-60 min
- Dati stabili (brief, clienti): 10-30 min
- Dati AI (caption, idee): non cachare

## Cosa NON fare
- `fetch()` diretto nei componenti
- `useEffect` + `useState` per caricare dati
- `localStorage` per dati che vengono dal server
- Nessuno `staleTime` (default = 0, nessuna cache)
- Nessun `invalidateQueries` dopo mutation

## Come aggiungere un nuovo tool
1. Crea hook in `src/hooks/use[Domain].ts`
2. Usa namespace query key del dominio
3. `staleTime` esplicito sempre
4. `invalidateQueries` in `onSuccess`
5. Loading state e error state sempre presenti
