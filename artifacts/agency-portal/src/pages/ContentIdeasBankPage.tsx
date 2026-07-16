import { Layout } from "@/components/layout/Layout";
import { ContentIdeasBank } from "@/components/client/ContentIdeasBank";

/* Pagina "Banca Idee" — tutte le idee di tutti i clienti in un punto solo,
   filtrabili per cliente/piattaforma/stato. La stessa banca, vista cliente per
   cliente, sta nella tab "Banca Idee" del cockpit (/clients/:id?tab=banca).

   Volutamente senza <RequireActiveClient> (vedi App.tsx): come Ore e
   Comunicazioni, questa pagina è cross-cliente e ha senso anche senza un
   cliente attivo selezionato in alto. */

export default function ContentIdeasBankPage() {
  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <ContentIdeasBank />
      </div>
    </Layout>
  );
}
