-- Tabella per le notizie agroalimentari
CREATE TABLE daily_news (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  abstract TEXT,
  url TEXT NOT NULL,
  ranking_score FLOAT DEFAULT 0,
  published_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Esempio di inserimento dati
INSERT INTO daily_news (title, source, abstract, url, ranking_score, published_at)
VALUES 
('Prezzi del grano in aumento nel Q4', 'Reuters Agri', 'I prezzi globali del grano sono aumentati del 10% a causa delle condizioni climatiche avverse in Australia.', 'https://example.com/news1', 9.5, CURRENT_DATE),
('Innovazione nel settore Vertical Farming', 'AgriTech Daily', 'Nuove tecnologie LED permettono un risparmio energetico del 30% nelle serre verticali in Olanda.', 'https://example.com/news2', 8.2, CURRENT_DATE);

-- Configurazione Sicurezza (RLS)
-- Abilita la RLS sulla tabella
ALTER TABLE daily_news ENABLE ROW LEVEL SECURITY;

-- Crea una policy per permettere a chiunque (anon) di leggere le notizie
CREATE POLICY "Permetti lettura pubblica" 
ON daily_news 
FOR SELECT 
TO anon 
USING (true);
