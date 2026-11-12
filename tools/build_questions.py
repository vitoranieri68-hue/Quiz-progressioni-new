#!/usr/bin/env python3
"""Rigenera questions.js dalla banca dati Excel sorgente."""
from pathlib import Path
from collections import Counter
import json, re, sys
from openpyxl import load_workbook

def clean(value):
    return re.sub(r"\s+", " ", str(value)).strip()

def normalize_subject(value):
    text = clean(value).casefold()
    mapping = [
        ("procedura penale", "criminal"),
        ("procedura civile", "civil"),
        ("servizi di cancelleria", "registry"),
        ("diritto amministrativo", "administrative"),
    ]
    for fragment, key in mapping:
        if fragment in text:
            return key
    raise ValueError(f"Materia non riconosciuta: {value!r}")

def main(source, destination):
    workbook = load_workbook(source, data_only=True, read_only=True)
    sheet = workbook[workbook.sheetnames[0]]
    questions = []
    for row in sheet.iter_rows(min_row=3, values_only=True):
        if not row or all(value is None for value in row):
            continue
        if len(row) < 6 or any(value is None or clean(value) == "" for value in row[:6]):
            raise ValueError(f"Riga incompleta: {row!r}")
        number, subject, question, correct, wrong1, wrong2 = row[:6]
        answers = [clean(correct), clean(wrong1), clean(wrong2)]
        if len(set(answers)) != 3:
            raise ValueError(f"Risposte duplicate nel quesito {number}")
        questions.append({
            "id": int(number), "subject": normalize_subject(subject),
            "question": clean(question), "correct": answers[0], "wrong": answers[1:]
        })
    ids = [item["id"] for item in questions]
    duplicates = [key for key, count in Counter(ids).items() if count > 1]
    if duplicates:
        raise ValueError(f"ID duplicati: {duplicates}")
    if len(questions) != 180:
        raise ValueError(f"Attesi 180 quesiti, trovati {len(questions)}")
    payload = json.dumps(questions, ensure_ascii=False, separators=(",", ":"))
    Path(destination).write_text(
        "/* Generato dal file Excel sorgente. Non modificare manualmente. */\n"
        f"window.QUIZ_QUESTIONS=Object.freeze({payload});\n", encoding="utf-8")
    print(f"Creato {destination}: {len(questions)} quesiti")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Uso: build_questions.py SORGENTE.xlsx DESTINAZIONE.js")
    main(sys.argv[1], sys.argv[2])
