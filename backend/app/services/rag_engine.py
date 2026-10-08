import os
# Disable TensorFlow import in transformers to prevent protobuf version conflicts
os.environ["USE_TF"] = "0"
os.environ["USE_TORCH"] = "1"
os.environ["TRANSFORMERS_NO_ADVISORY_WARNINGS"] = "1"

import logging
from typing import List, Dict, Any, Optional
import fitz  # PyMuPDF
import chromadb
from chromadb.utils import embedding_functions

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class RAGEngine:
    def __init__(self):
        os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
        self.chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
        self._embedding_model = None

    @property
    def embedding_model(self):
        if self._embedding_model is None:
            logger.info("Loading sentence-transformers/all-MiniLM-L6-v2 embedding model...")
            from sentence_transformers import SentenceTransformer  # lazy import to save startup RAM
            self._embedding_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        return self._embedding_model

    def extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text from a PDF file using PyMuPDF."""
        try:
            doc = fitz.open(file_path)
            text_blocks = []
            for page in doc:
                text_blocks.append(page.get_text())
            doc.close()
            return "\n".join(text_blocks)
        except Exception as e:
            logger.error(f"Error reading PDF {file_path}: {e}")
            raise

    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """Recursive character-style text chunking."""
        if not text:
            return []
        chunks = []
        start = 0
        text_len = len(text)
        
        while start < text_len:
            end = start + chunk_size
            chunk = text[start:end]
            chunks.append(chunk.strip())
            start += (chunk_size - overlap)
        return [c for c in chunks if c]

    def ingest_document(
        self,
        drive_id: str,
        doc_id: str,
        file_path: str,
        doc_type: str = "jd"
    ) -> str:
        """
        Extracts, chunks, embeds and indexes document in ChromaDB collection.
        Returns Chroma collection name.
        """
        collection_name = f"drive_{drive_id}"
        collection = self.chroma_client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

        text = self.extract_text_from_pdf(file_path) if file_path.endswith(".pdf") else open(file_path, "r", encoding="utf-8").read()
        chunks = self.chunk_text(text)
        
        if not chunks:
            logger.warning(f"No text extracted from document {file_path}")
            return collection_name

        # Generate embeddings using MiniLM
        embeddings = self.embedding_model.encode(chunks).tolist()

        ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [
            {
                "drive_id": drive_id,
                "doc_id": doc_id,
                "doc_type": doc_type,
                "chunk_index": i
            }
            for i in range(len(chunks))
        ]

        collection.add(
            ids=ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas
        )

        logger.info(f"Ingested {len(chunks)} chunks into ChromaDB collection {collection_name}")
        return collection_name

    def query_context(
        self,
        drive_id: str,
        query: str,
        top_k: int = 4,
        doc_type_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Queries ChromaDB for relevant document chunks using cosine similarity.
        """
        collection_name = f"drive_{drive_id}"
        try:
            collection = self.chroma_client.get_collection(name=collection_name)
        except Exception:
            logger.warning(f"Collection {collection_name} does not exist in ChromaDB.")
            return []

        query_embedding = self.embedding_model.encode([query]).tolist()
        
        where_filter = {}
        if doc_type_filter:
            where_filter["doc_type"] = doc_type_filter

        results = collection.query(
            query_embeddings=query_embedding,
            n_results=top_k,
            where=where_filter if where_filter else None
        )

        output_chunks = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if "metadatas" in results else [{}] * len(docs)
            distances = results["distances"][0] if "distances" in results else [0.0] * len(docs)

            for doc, meta, dist in zip(docs, metas, distances):
                output_chunks.append({
                    "content": doc,
                    "metadata": meta,
                    "score": round(1.0 - dist, 4) if dist is not None else 1.0
                })

        return output_chunks

_rag_engine_instance: Optional[RAGEngine] = None

def get_rag_engine() -> RAGEngine:
    global _rag_engine_instance
    if _rag_engine_instance is None:
        _rag_engine_instance = RAGEngine()
    return _rag_engine_instance
