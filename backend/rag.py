import os
import chromadb
from typing import List, Dict, Any
from backend.schemas import RetrievedChunk, KnowledgeRetrieval

# Initialize ChromaDB client (persistent on disk)
CHROMA_DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chroma_db")
chroma_client = chromadb.PersistentClient(path=CHROMA_DB_DIR)
collection_name = "inside_ai_kb"

def get_or_create_collection():
    """Get or create the ChromaDB collection. 
    By default, ChromaDB uses the SentenceTransformer / ONNX MiniLM-L6-v2 embedding function locally.
    """
    return chroma_client.get_or_create_collection(name=collection_name)

def seed_knowledge_base():
    """Seed the ChromaDB collection with a curated set of explainer articles if empty.
    ChromaDB handles the local embedding computations automatically.
    """
    collection = get_or_create_collection()
    
    # Check if already seeded
    if collection.count() > 0:
        print(f"Knowledge base already contains {collection.count()} entries. Skipping seeding.")
        return

    print("Seeding knowledge base with curated AI, CS, Science, and Tech content...")
    
    # Define a clean curated list of documents
    corpus = [
        # Transformers & Attention
        {
            "text": "The Transformer is a deep learning model architecture introduced in 2017 in the paper 'Attention Is All You Need'. It relies on self-attention mechanisms to compute representations of its input and output without using sequence-aligned RNNs or convolution. This allows for significantly more parallelization and makes it the foundation for modern Large Language Models (LLMs).",
            "source": "Transformer Architecture Overview",
        },
        {
            "text": "Self-attention in Transformers allows the model to associate each word in the input sequence with every other word, determining how much focus to place on different parts of the sequence. It calculates three vectors for each token: Query (Q), Key (K), and Value (V). The attention score is determined by the dot product of Q and K, scaled, and passed through a softmax function to weigh the V vectors.",
            "source": "Transformer: Self-Attention Mechanism",
        },
        {
            "text": "Positional Encoding is used in Transformers to inject information about the relative or absolute position of tokens in a sequence, since the self-attention mechanism itself does not process data sequentially. It uses sine and cosine functions of different frequencies to generate unique position vectors that are added to the input word embeddings.",
            "source": "Transformer: Positional Encoding",
        },
        # Quantum Computing
        {
            "text": "Quantum computing is a multidisciplinary field comprising aspects of computer science, physics, and mathematics that utilizes quantum mechanics to solve complex problems faster than on classical computers. The basic unit of quantum information is the qubit, which can exist in a state of superposition, entanglement, and interference.",
            "source": "Quantum Computing Basics",
        },
        {
            "text": "Superposition is a fundamental principle of quantum mechanics where a physical system, like a qubit, can exist in multiple states simultaneously. Unlike a classical bit that is strictly 0 or 1, a qubit in superposition exists as a linear combination of both states until it is measured, collapsing it into a deterministic 0 or 1.",
            "source": "Quantum Mechanics: Superposition",
        },
        {
            "text": "Entanglement is a quantum phenomenon where two or more qubits become interconnected, such that the state of one qubit instantaneously determines the state of the other, no matter the distance between them. Einstein called this 'spooky action at a distance'. It enables quantum computers to process massive parallel computations.",
            "source": "Quantum Mechanics: Entanglement",
        },
        # Retrieval-Augmented Generation (RAG)
        {
            "text": "Retrieval-Augmented Generation (RAG) is a technique that optimizes the output of a Large Language Model by querying an external knowledge base of authoritative or domain-specific information before generating a response. This process reduces hallucinations, ensures the model has access to up-to-date facts, and provides transparency via source attribution.",
            "source": "RAG Overview",
        },
        {
            "text": "A Vector Database is a specialized database designed to store, index, and query high-dimensional vector embeddings. It represents data points (such as text, images, or audio) based on their semantic meaning. Popular vector databases include ChromaDB, Pinecone, Milvus, and Qdrant, which use algorithms like HNSW to perform fast nearest-neighbor search.",
            "source": "Vector Databases & Semantics",
        },
        # Computer Networks & Security
        {
            "text": "The Domain Name System (DNS) is the phonebook of the Internet. It translates human-readable domain names (like www.example.com) into machine-readable IP addresses (like 192.0.2.1). This mapping allows web browsers to load internet resources without users needing to memorize complex numeric addresses.",
            "source": "DNS Mechanics",
        },
        {
            "text": "Public-key Cryptography, also known as asymmetric cryptography, is a security system that uses pairs of keys: a public key, which may be disseminated widely, and a private key, which is known only to the owner. The generation of such keys depends on cryptographic algorithms based on mathematical problems (e.g., prime factorization in RSA) to produce one-way functions.",
            "source": "Asymmetric Cryptography",
        },
        # Biology & Genetics
        {
            "text": "CRISPR-Cas9 is a unique technology that enables geneticists and medical researchers to edit parts of the genome by removing, adding, or altering sections of the DNA sequence. It is derived from a naturally occurring genome editing system in bacteria, which use it to destroy invading viruses.",
            "source": "Genetics: CRISPR-Cas9",
        },
        {
            "text": "DNA (Deoxyribonucleic acid) stores genetic instructions in a double-helix structure composed of four chemical bases: Adenine (A), Thymine (T), Cytosine (C), and Guanine (G). RNA (Ribonucleic acid) is a single-stranded molecule that translates these genetic codes into proteins via transcription and translation processes.",
            "source": "Molecular Biology: DNA and RNA",
        },
        # Large Language Model Training & RLHF
        {
            "text": "Reinforcement Learning from Human Feedback (RLHF) is a training method used to align large language models with human preferences. It uses human evaluations of model outputs to train a reward model, which then guides the LLM's behavior via reinforcement learning algorithms like PPO (Proximal Policy Optimization).",
            "source": "LLM Alignment: RLHF",
        },
        {
            "text": "Quantization is a model optimization technique that reduces the numerical precision of weights and activations from high-precision floating-point formats (like FP32 or FP16) to lower-precision formats (like INT8 or INT4). This significantly reduces memory usage and speeds up inference latency, making it possible to run large models on consumer hardware.",
            "source": "ML Optimization: Quantization",
        }
    ]

    texts = [item["text"] for item in corpus]
    ids = [f"id_{i}" for i in range(len(corpus))]
    metadatas = [{"source": item["source"]} for item in corpus]

    try:
        # ChromaDB automatically embeds and stores the documents locally
        collection.add(
            documents=texts,
            metadatas=metadatas,
            ids=ids
        )
        print(f"Successfully seeded {len(corpus)} entries into ChromaDB.")
    except Exception as e:
        print(f"Error seeding ChromaDB: {e}")

def query_knowledge_base(query: str, top_k: int = 3) -> KnowledgeRetrieval:
    """Query the knowledge base for top_k relevant documents."""
    collection = get_or_create_collection()
    
    # If the database is empty, seed it
    if collection.count() == 0:
        seed_knowledge_base()
        
    if collection.count() == 0:
        return KnowledgeRetrieval(retrieved_chunks=[], retrieval_used=False)

    try:
        # Query ChromaDB (it will embed the query automatically)
        results = collection.query(
            query_texts=[query],
            n_results=top_k
        )
        
        chunks = []
        if results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if results["metadatas"] else [{}] * len(docs)
            distances = results["distances"][0] if results["distances"] else [0.0] * len(docs)
            
            for doc, meta, dist in zip(docs, metas, distances):
                # distance is cosine distance (0.0 means identical, 1.0/2.0 means different)
                similarity = max(0.0, min(1.0, 1.0 - dist))
                chunks.append(RetrievedChunk(
                    text=doc,
                    score=round(similarity, 3),
                    source=meta.get("source", "Unknown")
                ))
                
        return KnowledgeRetrieval(retrieved_chunks=chunks, retrieval_used=True)
    except Exception as e:
        print(f"Error querying knowledge base: {e}")
        return KnowledgeRetrieval(retrieved_chunks=[], retrieval_used=False)

if __name__ == "__main__":
    print("Testing knowledge base seeding...")
    seed_knowledge_base()
    print("Testing query...")
    results = query_knowledge_base("how does attention work in transformer models?")
    for chunk in results.retrieved_chunks:
        print(f"[{chunk.source}] (Score: {chunk.score}): {chunk.text[:100]}...")
