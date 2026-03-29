import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class ParsedCommand:
    command_type: Optional[str]
    identifier: Optional[str]
    confidence: str  # "full", "partial", "none"


# Command patterns — longer phrases first to avoid partial matches
COMMAND_PATTERNS = [
    ("Начать обработку", r"начать\s+обработк[уи]"),
    ("Отменить обработку", r"отменить\s+обработк[уи]"),
    ("Отменить регистрацию", r"отменить\s+регистраци[юи]"),
    ("Завершить обработку", r"завершить\s+обработк[уи]"),
    ("Зарегистрировать", r"зарегистрировать"),
]

# Filler words between command and identifier
FILLER_PATTERN = r"\b(трубу|трубы|труб[аеой]|плавк[уиеой]|плавки|номер|номером|под)\b"

# Direct digit sequences in VOSK output
DIRECT_NUMERIC = re.compile(r"\b(\d{4,10})\b")
# Direct alphanumeric like Р45345ИВ
DIRECT_ALPHANUM = re.compile(r"\b([А-Яа-яA-Za-z]\d{2,8}[А-Яа-яA-Za-z]{1,4})\b")

# Single digit words
DIGIT_WORDS = {
    "ноль": "0", "нуль": "0",
    "один": "1", "одна": "1", "одно": "1", "раз": "1",
    "два": "2", "две": "2",
    "три": "3",
    "четыре": "4",
    "пять": "5",
    "шесть": "6",
    "семь": "7",
    "восемь": "8",
    "девять": "9",
}

# Teens and tens
COMPOUND_NUMBERS = {
    "десять": 10, "одиннадцать": 11, "двенадцать": 12,
    "тринадцать": 13, "четырнадцать": 14, "пятнадцать": 15,
    "шестнадцать": 16, "семнадцать": 17, "восемнадцать": 18,
    "девятнадцать": 19,
    "двадцать": 20, "тридцать": 30, "сорок": 40, "пятьдесят": 50,
    "шестьдесят": 60, "семьдесят": 70, "восемьдесят": 80, "девяносто": 90,
    "сто": 100, "двести": 200, "триста": 300, "четыреста": 400,
    "пятьсот": 500, "шестьсот": 600, "семьсот": 700,
    "восемьсот": 800, "девятьсот": 900,
}

MULTIPLIERS = {
    "тысяча": 1000, "тысячи": 1000, "тысяч": 1000,
    "миллион": 1000000, "миллиона": 1000000, "миллионов": 1000000,
}

# Cyrillic letter pronunciation → letter
LETTER_WORDS = {
    "а": "А", "бэ": "Б", "б": "Б", "вэ": "В", "в": "В",
    "гэ": "Г", "г": "Г", "дэ": "Д", "д": "Д",
    "е": "Е", "жэ": "Ж", "ж": "Ж", "зэ": "З", "з": "З",
    "и": "И", "ий": "И",
    "ка": "К", "к": "К", "эль": "Л", "л": "Л",
    "эм": "М", "м": "М", "эн": "Н", "н": "Н", "о": "О",
    "пэ": "П", "п": "П", "эр": "Р", "рэ": "Р", "р": "Р",
    "эс": "С", "с": "С", "тэ": "Т", "т": "Т", "у": "У",
    "эф": "Ф", "ф": "Ф", "ха": "Х", "х": "Х",
    "цэ": "Ц", "ц": "Ц", "чэ": "Ч", "ч": "Ч",
    "ша": "Ш", "ш": "Ш", "ща": "Щ", "щ": "Щ",
    "э": "Э", "ю": "Ю", "я": "Я",
}


def _get_word_value(w: str) -> Optional[int]:
    """Get numeric value of a single word."""
    if w in DIGIT_WORDS:
        return int(DIGIT_WORDS[w])
    if w in COMPOUND_NUMBERS:
        return COMPOUND_NUMBERS[w]
    return None


def _assemble_one_number(words: list[str]) -> int:
    """Assemble a single compound number from words.
    E.g. ['сто', 'двадцать', 'три'] → 123
         ['двадцать', 'одна', 'тысяча', 'девятьсот'] → 21900
    """
    total = 0
    current = 0
    for w in words:
        if w in MULTIPLIERS:
            if current == 0:
                current = 1
            current *= MULTIPLIERS[w]
            total += current
            current = 0
        else:
            val = _get_word_value(w)
            if val is not None:
                current += val
    return total + current


def _rank_of(val: int) -> int:
    """Return positional rank: units=0, tens=1, hundreds=2."""
    if val >= 100:
        return 2
    if val >= 10:
        return 1
    return 0


def _split_into_number_groups(words: list[str]) -> list[list[str]]:
    """Split number words into groups where each group is one compound number.

    Rule: a new group starts when the next word's rank is >= any already-filled
    rank in the current group (i.e. it cannot logically extend the number).
    Multipliers also trigger a new group if the current group already has
    a completed sub-number with lower ranks.
    """
    if not words:
        return []

    groups: list[list[str]] = []
    current_group: list[str] = []
    filled_ranks: set[int] = set()  # ranks occupied in current sub-group
    prev_was_multiplier = False

    def flush():
        nonlocal current_group, filled_ranks, prev_was_multiplier
        if current_group:
            groups.append(current_group)
        current_group = []
        filled_ranks = set()
        prev_was_multiplier = False

    for w in words:
        if w in MULTIPLIERS:
            # In identifier context, multipliers always start a new group
            # "девяносто четыре | тысяча" → "94" + "1000"
            if filled_ranks:
                flush()
            current_group.append(w)
            filled_ranks = set()
            prev_was_multiplier = True
            continue

        val = _get_word_value(w)
        if val is None:
            continue

        rank = _rank_of(val)

        # Conflict: same or higher rank already filled in current sub-group
        conflict = False
        if rank in filled_ranks:
            conflict = True
        elif filled_ranks and rank > max(filled_ranks):
            # Higher rank after lower ranks: "пять | сто" or "сорок пять | триста"
            conflict = True

        if conflict:
            flush()

        current_group.append(w)
        filled_ranks.add(rank)
        prev_was_multiplier = False

    flush()
    return groups


def _words_to_number_groups(words: list[str]) -> str:
    """Convert Russian number words into concatenated digit string.

    'сто двадцать три сто двадцать три' → '123123'
    'сорок пять триста сорок пять' → '45345'
    """
    groups = _split_into_number_groups(words)
    return "".join(str(_assemble_one_number(g)) for g in groups)


def _spoken_to_identifier(text: str) -> Optional[str]:
    """Convert spoken words to an identifier (digits + optional letters)."""
    tokens = text.split()
    result = []
    i = 0
    while i < len(tokens):
        token = tokens[i]

        # Check single letter word
        if token in LETTER_WORDS:
            result.append(LETTER_WORDS[token])
            i += 1
            continue

        # Try to parse a number sequence
        num_words = []
        j = i
        while j < len(tokens):
            t = tokens[j]
            if t in DIGIT_WORDS or t in COMPOUND_NUMBERS or t in MULTIPLIERS:
                num_words.append(t)
                j += 1
            else:
                break

        if num_words:
            # Check if it's digit-by-digit (all single digits)
            all_single = all(w in DIGIT_WORDS for w in num_words)
            if all_single:
                for w in num_words:
                    result.append(DIGIT_WORDS[w])
            else:
                result.append(_words_to_number_groups(num_words))
            i = j
            continue

        # Skip unknown words
        i += 1

    identifier = "".join(result)
    return identifier if identifier else None


def parse_command(transcription: str) -> ParsedCommand:
    """Parse a VOSK transcription to extract command type and identifier."""
    text = transcription.strip().lower()

    # 1. Extract command type
    command_type = None
    remaining = text
    for cmd_name, pattern in COMMAND_PATTERNS:
        match = re.search(pattern, text)
        if match:
            command_type = cmd_name
            remaining = text[:match.start()] + text[match.end():]
            break

    # 2. Clean remaining text
    remaining = re.sub(FILLER_PATTERN, " ", remaining)
    remaining = re.sub(r"\s+", " ", remaining).strip()

    # 3. Try direct digit/alphanum in remaining text
    identifier = None
    direct_num = DIRECT_NUMERIC.search(remaining)
    direct_alpha = DIRECT_ALPHANUM.search(remaining)
    if direct_num:
        identifier = direct_num.group(1)
    elif direct_alpha:
        identifier = direct_alpha.group(1).upper()
    else:
        # 4. Convert spoken words to identifier
        identifier = _spoken_to_identifier(remaining)

    # 5. Determine confidence
    if command_type and identifier:
        confidence = "full"
    elif command_type or identifier:
        confidence = "partial"
    else:
        confidence = "none"

    return ParsedCommand(command_type=command_type, identifier=identifier, confidence=confidence)
