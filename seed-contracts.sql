-- Seed template contratti (italiano) per Be Kind Social Agency HUB.
-- Esegui DOPO la migration che aggiunge `variables` e la tabella `contract_documents`.
-- Idempotente sugli slug elencati (rimuove e reinserisce i 6 template predefiniti).

DELETE FROM contract_templates WHERE type IN (
  'social_mensile',
  'ads',
  'content_plan',
  'consulenza',
  'full_service',
  'una_tantum'
);

INSERT INTO contract_templates (name, type, content, status, variables) VALUES
(
  'Gestione Social Media (mensile)',
  'social_mensile',
  $html$
<p><img src="{{URL_LOGO}}" alt="Logo agenzia" style="max-height:48px" /></p>
<p><strong>CONTRATTO DI FORNITURA — GESTIONE SOCIAL MEDIA</strong></p>
<p>Il presente contratto è stipulato in data <strong>{{DATA_ODIERNA}}</strong> tra:</p>
<p><strong>{{AGENZIA_NOME}}</strong>, con sede in {{AGENZIA_INDIRIZZO}}, P.IVA {{AGENZIA_PIVA}}, PEC {{AGENZIA_PEC}}, IBAN {{AGENZIA_IBAN}} (di seguito &quot;Agenzia&quot;)</p>
<p>e</p>
<p><strong>{{NOME_CLIENTE}}</strong>, e-mail {{EMAIL_CLIENTE}}, P.IVA/C.F. {{PIVA_CLIENTE}}, con sede in {{INDIRIZZO_CLIENTE}} (di seguito &quot;Cliente&quot;).</p>
<h3>1. Oggetto</h3>
<p>L&apos;Agenzia si impegna a gestire i canali social <strong>{{CANALI_SOCIAL}}</strong>, con una media di <strong>{{NUMERO_POST_MESE}}</strong> contenuti editoriali pubblicati al mese (salvo diverso accordo scritto), coerenti con gli obiettivi di brand e lead concordati.</p>
<h3>2. Obiettivi</h3>
<p>Obiettivi strategici: presenza costante, coerenza del tono di voce, crescita qualitativa dell&apos;engagement e supporto alle campagne promozionali comunicate dal Cliente.</p>
<h3>3. Deliverable</h3>
<p>Calendario editoriale condiviso, pubblicazione dei contenuti approvati, monitoraggio commenti base (moderazione lieve), report mensile sintetico su andamento e raccomandazioni.</p>
<h3>4. Revisioni</h3>
<p>Sono inclusi fino a <strong>due (2) giri di revisione</strong> per ciascun batch di contenuti pianificati, entro 5 giorni lavorativi dalla consegna bozze.</p>
<h3>5. Corrispettivo e durata</h3>
<p>Il corrispettivo mensile è di <strong>{{IMPORTO_MENSILE}}</strong> (IVA esclusa ove dovuta). Durata del rapporto: <strong>{{DURATA}}</strong>, con decorrenza da {{DATA_INIZIO}} a {{DATA_FINE}} salvo proroghe scritte.</p>
<h3>6. Rinnovo automatico</h3>
<p>Salvo disdetta da comunicarsi a mezzo PEC o e-mail con almeno 30 giorni di anticipo rispetto alla scadenza, il contratto si intende tacitamente rinnovato alle stesse condizioni economiche e operative, salvo aggiornamenti concordati per iscritto.</p>
<h3>7. Firme</h3>
<p>Letto, approvato e sottoscritto. Per l&apos;Agenzia: ______________________ &nbsp; Data: ___________<br/>Per il Cliente: ______________________ &nbsp; Data: ___________</p>
$html$,
  'attivo',
  '["URL_LOGO","AGENZIA_NOME","AGENZIA_INDIRIZZO","AGENZIA_PIVA","AGENZIA_PEC","AGENZIA_IBAN","DATA_ODIERNA","NOME_CLIENTE","EMAIL_CLIENTE","PIVA_CLIENTE","INDIRIZZO_CLIENTE","CANALI_SOCIAL","NUMERO_POST_MESE","IMPORTO_MENSILE","DURATA","DATA_INIZIO","DATA_FINE"]'::jsonb
),
(
  'Campagne pubblicitarie (Ads)',
  'ads',
  $html$
<p><img src="{{URL_LOGO}}" alt="Logo agenzia" style="max-height:48px" /></p>
<p><strong>CONTRATTO DI FORNITURA — CAMPAGNE PUBBLICITARIE (ADS)</strong></p>
<p>Stipulato in data <strong>{{DATA_ODIERNA}}</strong> tra <strong>{{AGENZIA_NOME}}</strong> ({{AGENZIA_INDIRIZZO}}, P.IVA {{AGENZIA_PIVA}}, PEC {{AGENZIA_PEC}}) e <strong>{{NOME_CLIENTE}}</strong> ({{EMAIL_CLIENTE}}, P.IVA/C.F. {{PIVA_CLIENTE}}, {{INDIRIZZO_CLIENTE}}).</p>
<h3>1. Oggetto</h3>
<p>Pianificazione, attivazione e ottimizzazione di campagne ads sulle piattaforme: <strong>{{PIATTAFORME_ADS}}</strong>.</p>
<h3>2. Budget e fee</h3>
<p>Budget pubblicitario stimato (addebitato direttamente sulle piattaforme o gestito come da accordi): <strong>{{BUDGET_ADS}}</strong>. Fee di gestione e strategia: <strong>{{FEE_GESTIONE}}</strong>. Durata campagna: <strong>{{DURATA_CAMPAGNA}}</strong>.</p>
<h3>3. KPI concordati</h3>
<p>KPI di riferimento (da declinare nel piano media): CPA/CPL target, ROAS orientativo, volume conversioni o lead, reach/frequenza massima. Gli obiettivi restano indicativi e dipendono anche da creatività, offerta e mercato.</p>
<h3>4. Reportistica</h3>
<p>Report periodici con spese, risultati principali, insight e azioni correttive proposte, secondo la frequenza concordata (es. settimanale o bisettimanale durante la fase di scaling).</p>
<h3>5. Budget minimo</h3>
<p>Il Cliente riconosce che sotto una certa soglia di investimento le piattaforme potrebbero non raggiungere significatività statistica; le parti concordano un budget minimo operativo di <strong>{{BUDGET_MINIMO}}</strong> o quanto diversamente pattuito per iscritto.</p>
<h3>6. Firme</h3>
<p>Per l&apos;Agenzia: ______________________ &nbsp; Data: ___________<br/>Per il Cliente: ______________________ &nbsp; Data: ___________</p>
$html$,
  'attivo',
  '["URL_LOGO","AGENZIA_NOME","AGENZIA_INDIRIZZO","AGENZIA_PIVA","AGENZIA_PEC","DATA_ODIERNA","NOME_CLIENTE","EMAIL_CLIENTE","PIVA_CLIENTE","INDIRIZZO_CLIENTE","PIATTAFORME_ADS","BUDGET_ADS","FEE_GESTIONE","DURATA_CAMPAGNA","BUDGET_MINIMO"]'::jsonb
),
(
  'Creazione contenuti / Content plan',
  'content_plan',
  $html$
<p><img src="{{URL_LOGO}}" alt="Logo agenzia" style="max-height:48px" /></p>
<p><strong>CONTRATTO DI FORNITURA — CREAZIONE CONTENUTI E CONTENT PLAN</strong></p>
<p>Tra <strong>{{AGENZIA_NOME}}</strong> ({{AGENZIA_INDIRIZZO}}, P.IVA {{AGENZIA_PIVA}}) e <strong>{{NOME_CLIENTE}}</strong> ({{EMAIL_CLIENTE}}, {{INDIRIZZO_CLIENTE}}), data <strong>{{DATA_ODIERNA}}</strong>.</p>
<h3>1. Oggetto</h3>
<p>Produzione di contenuti di tipologia <strong>{{TIPOLOGIA_CONTENUTI}}</strong>, quantità: <strong>{{QUANTITA}}</strong>, formato: <strong>{{FORMATO}}</strong> (foto/video/reel/carousel ecc.).</p>
<h3>2. Tempi di consegna</h3>
<p>Le bozze saranno consegnate secondo il calendario condiviso; salvo urgenze documentate, i termini medi non superano 7–10 giorni lavorativi dal ricevimento del brief completo e dei materiali.</p>
<h3>3. Revisioni</h3>
<p>Sono inclusi <strong>{{NUMERO_REVISIONI}}</strong> giri di revisione entro il perimetro del brief approvato. Richieste extra o cambi di concept possono essere quotate separatamente.</p>
<h3>4. Proprietà intellettuale</h3>
<p>All&apos;integrale pagamento del corrispettivo, il Cliente acquisisce la licenza d&apos;uso dei contenuti finali nei canali concordati. L&apos;Agenzia può richiedere attribuzione/portfolio salvo diverso NDA.</p>
<h3>5. Corrispettivo</h3>
<p>Totale: <strong>{{IMPORTO}}</strong> (IVA esclusa ove dovuta), secondo modalità di pagamento pattuite.</p>
<h3>6. Firme</h3>
<p>Per l&apos;Agenzia: ______________________ &nbsp; Data: ___________<br/>Per il Cliente: ______________________ &nbsp; Data: ___________</p>
$html$,
  'attivo',
  '["URL_LOGO","AGENZIA_NOME","AGENZIA_INDIRIZZO","AGENZIA_PIVA","DATA_ODIERNA","NOME_CLIENTE","EMAIL_CLIENTE","INDIRIZZO_CLIENTE","TIPOLOGIA_CONTENUTI","QUANTITA","FORMATO","NUMERO_REVISIONI","IMPORTO"]'::jsonb
),
(
  'Consulenza strategica',
  'consulenza',
  $html$
<p><img src="{{URL_LOGO}}" alt="Logo agenzia" style="max-height:48px" /></p>
<p><strong>CONTRATTO DI CONSULENZA STRATEGICA</strong></p>
<p>Tra <strong>{{AGENZIA_NOME}}</strong> ({{AGENZIA_INDIRIZZO}}, P.IVA {{AGENZIA_PIVA}}, PEC {{AGENZIA_PEC}}) e <strong>{{NOME_CLIENTE}}</strong> ({{EMAIL_CLIENTE}}, {{INDIRIZZO_CLIENTE}}), data {{DATA_ODIERNA}}.</p>
<h3>1. Oggetto</h3>
<p>Consulenza specialistica per <strong>{{OBIETTIVI_CONSULENZA}}</strong>, per un totale di <strong>{{ORE_CONSULENZA}}</strong> ore, tariffa oraria <strong>{{TARIFFA_ORARIA}}</strong>, modalità: <strong>{{MODALITA}}</strong> (videochiamata / presenza / mista).</p>
<h3>2. NDA e riservatezza</h3>
<p>Le parti si impegnano a non divulgare informazioni riservate, documenti, dati commerciali e know-how acquisiti durante il rapporto, anche oltre la cessazione, salvo obblighi di legge.</p>
<h3>3. Modalità di pagamento</h3>
<p>Pagamento secondo quanto concordato (anticipo / a consuntivo / a milestone). In caso di ritardo oltre 30 giorni, l&apos;Agenzia può sospendere le attività fino a regolarizzazione.</p>
<h3>4. Firme</h3>
<p>Per l&apos;Agenzia: ______________________ &nbsp; Data: ___________<br/>Per il Cliente: ______________________ &nbsp; Data: ___________</p>
$html$,
  'attivo',
  '["URL_LOGO","AGENZIA_NOME","AGENZIA_INDIRIZZO","AGENZIA_PIVA","AGENZIA_PEC","DATA_ODIERNA","NOME_CLIENTE","EMAIL_CLIENTE","INDIRIZZO_CLIENTE","OBIETTIVI_CONSULENZA","ORE_CONSULENZA","TARIFFA_ORARIA","MODALITA"]'::jsonb
),
(
  'Pacchetto completo (Full service)',
  'full_service',
  $html$
<p><img src="{{URL_LOGO}}" alt="Logo agenzia" style="max-height:48px" /></p>
<p><strong>CONTRATTO FULL SERVICE — MARKETING &amp; SOCIAL</strong></p>
<p>Tra <strong>{{AGENZIA_NOME}}</strong> ({{AGENZIA_INDIRIZZO}}, P.IVA {{AGENZIA_PIVA}}, IBAN {{AGENZIA_IBAN}}) e <strong>{{NOME_CLIENTE}}</strong> ({{EMAIL_CLIENTE}}, {{INDIRIZZO_CLIENTE}}), data {{DATA_ODIERNA}}.</p>
<h3>1. Servizi inclusi</h3>
<p><strong>{{SERVIZI_INCLUSI}}</strong> (strategia, social, contenuti, ads, reporting e coordinamento operativo come da allegato operativo / piano di lavoro).</p>
<h3>2. SLA e referente</h3>
<p>L&apos;Agenzia garantisce tempi di risposta operativa entro <strong>{{TEMPI_RISPOSTA_SLA}}</strong> in giorni lavorativi per richieste standard. È dedicato un referente: <strong>{{REFERENTE_DEDICATO}}</strong>.</p>
<h3>3. Reportistica</h3>
<p>Report mensile con sintesi KPI, attività svolte, spese media (ove applicabile) e prossimi step strategici.</p>
<h3>4. Corrispettivo</h3>
<p>Importo totale: <strong>{{IMPORTO_TOTALE}}</strong>. Sconto applicato (se presente): <strong>{{SCONTO_APPLICATO}}</strong>.</p>
<h3>5. Firme</h3>
<p>Per l&apos;Agenzia: ______________________ &nbsp; Data: ___________<br/>Per il Cliente: ______________________ &nbsp; Data: ___________</p>
$html$,
  'attivo',
  '["URL_LOGO","AGENZIA_NOME","AGENZIA_INDIRIZZO","AGENZIA_PIVA","AGENZIA_IBAN","DATA_ODIERNA","NOME_CLIENTE","EMAIL_CLIENTE","INDIRIZZO_CLIENTE","SERVIZI_INCLUSI","TEMPI_RISPOSTA_SLA","REFERENTE_DEDICATO","IMPORTO_TOTALE","SCONTO_APPLICATO"]'::jsonb
),
(
  'Progetto una tantum',
  'una_tantum',
  $html$
<p><img src="{{URL_LOGO}}" alt="Logo agenzia" style="max-height:48px" /></p>
<p><strong>CONTRATTO DI PROGETTO UNA TANTUM</strong></p>
<p>Tra <strong>{{AGENZIA_NOME}}</strong> ({{AGENZIA_INDIRIZZO}}, P.IVA {{AGENZIA_PIVA}}) e <strong>{{NOME_CLIENTE}}</strong> ({{EMAIL_CLIENTE}}, {{INDIRIZZO_CLIENTE}}), data {{DATA_ODIERNA}}.</p>
<h3>1. Descrizione progetto</h3>
<p><strong>{{DESCRIZIONE_PROGETTO}}</strong></p>
<h3>2. Milestone e importi</h3>
<p>Milestone concordate: <strong>{{MILESTONE}}</strong>. Importo totale: <strong>{{IMPORTO}}</strong>. Acconto richiesto all&apos;avvio: <strong>{{ACCONTO}}</strong>.</p>
<h3>3. Fasi di lavoro e tempi</h3>
<p>Le fasi (kick-off, produzione, revisione, consegna) seguono il cronoprogramma allegato o concordato via e-mail. Ritardi imputabili al Cliente (mancanza materiali/approvazioni) estendono proporzionalmente le scadenze.</p>
<h3>4. Revisioni</h3>
<p>Revisioni incluse nel perimetro del progetto: <strong>{{GESTIONE_REVISIONI}}</strong>. Ulteriori modifiche sono quotate separatamente.</p>
<h3>5. Saldo alla consegna</h3>
<p>Il saldo è dovuto alla consegna del progetto approvato o entro i termini pattuiti, salvo diverso piano rateale firmato dalle parti.</p>
<h3>6. Firme</h3>
<p>Per l&apos;Agenzia: ______________________ &nbsp; Data: ___________<br/>Per il Cliente: ______________________ &nbsp; Data: ___________</p>
$html$,
  'attivo',
  '["URL_LOGO","AGENZIA_NOME","AGENZIA_INDIRIZZO","AGENZIA_PIVA","DATA_ODIERNA","NOME_CLIENTE","EMAIL_CLIENTE","INDIRIZZO_CLIENTE","DESCRIZIONE_PROGETTO","MILESTONE","IMPORTO","ACCONTO","GESTIONE_REVISIONI"]'::jsonb
);
