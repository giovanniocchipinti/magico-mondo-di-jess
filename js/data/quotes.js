// Frasi del giorno: una al giorno, sempre la stessa per tutta la giornata.
// Scritte per questa agenda: aggiungine, toglile o cambiale liberamente.

export const quotes = [
  'Una cosa alla volta, fatta bene, vale più di dieci iniziate.',
  'Le piante non crescono in un giorno, ma crescono ogni giorno.',
  'Scegli la cosa più importante e falla per prima.',
  'Non serve la giornata perfetta, serve la prossima ora fatta bene.',
  'Quello che pianifichi stasera è tempo che ti regali domani.',
  'Il lavoro che conta raramente è quello più urgente.',
  'Piccoli passi costanti battono le grandi corse occasionali.',
  'Finire è una competenza: allenala oggi.',
  'Un buco libero di mezz\'ora è un progetto che avanza.',
  'Fai spazio a ciò che vuoi costruire, non solo a ciò che ti chiedono.',
  'Le radici si fanno quando nessuno guarda.',
  'Dire di no a una cosa è dire di sì a un\'altra.',
  'Oggi conta più di ieri, e domani si prepara adesso.',
  'Meglio fatto e migliorabile che perfetto e mai partito.',
  'Due lavori, una vita: dai a ciascuno il suo tempo.',
  'Ogni cliente soddisfatto nasce da un dettaglio curato.',
  'Il riposo fa parte del piano, non è una pausa dal piano.',
  'Se una cosa richiede meno di due minuti, falla adesso.',
  'Guarda quanto hai fatto, non solo quanto manca.',
  'La costanza trasforma il difficile in abitudine.',
  'Una buona giornata comincia da una lista corta.',
  'Ciò che misuri migliora: spunta, conta, riparti.',
  'Ogni stagione ha il suo lavoro. Questa è la tua.',
  'Imparare un po\' ogni giorno è il miglior investimento che hai.',
  'Il tempo libero non va riempito: va scelto.',
  'Le scadenze sono più leggere quando le vedi arrivare.',
  'Chiudi una cosa prima di aprirne un\'altra.',
  'Stai costruendo qualcosa di tuo: rispetta quel tempo.',
  'Oggi basta fare un passo avanti su ciò che conta.',
  'Concentrazione è scegliere cosa ignorare.',
  'Chi semina con pazienza raccoglie con calma.',
];

// Stesso numero per tutto il giorno: giorni passati dal 1970 (in UTC), modulo il numero di frasi
export function quoteOfDay(isoDate) {
  const days = Math.floor(Date.parse(isoDate + 'T00:00:00Z') / 86400000);
  return quotes[days % quotes.length];
}
