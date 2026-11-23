"""Shared helpers: chat formatting with a loss mask, used by train.py and eval_gen.py so prompts match exactly."""
import json


def read_jsonl(p):
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


def prompt_text(tok, messages, family_kwargs=None):
    kw = dict(family_kwargs or {})
    try:
        return tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, **kw)
    except TypeError:
        return tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)


def turn_end(tok, messages, prompt, family_kwargs=None):
    """Text the template puts after the assistant content (end-of-turn marker), found by rendering the full chat."""
    kw = dict(family_kwargs or {})
    full = tok.apply_chat_template(messages, tokenize=False, **kw)
    content = messages[-1]["content"]
    if full.startswith(prompt) and full[len(prompt):].startswith(content):
        return full[len(prompt) + len(content):]
    return (tok.eos_token or "")


def encode_example(tok, messages, max_len, family_kwargs=None):
    """-> (input_ids, labels) with labels = -100 on the prompt, loss on assistant text + end-of-turn marker."""
    prompt = prompt_text(tok, messages[:-1], family_kwargs)
    tail = turn_end(tok, messages, prompt, family_kwargs)
    p_ids = tok(prompt, add_special_tokens=False)["input_ids"]
    t_ids = tok(messages[-1]["content"] + tail, add_special_tokens=False)["input_ids"]
    ids = (p_ids + t_ids)[:max_len]
    labels = ([-100] * len(p_ids) + t_ids)[:max_len]
    return ids, labels, len(p_ids) + len(t_ids) > max_len
