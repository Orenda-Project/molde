// Host test server around molde_core.h: the same code the phone runs, driven over stdin/stdout so the Node
// measurement tools can use the app's real generation loop with 4 threads on a laptop.
//   core_server MODEL.gguf LIBDIR [threads=4] [nctx=4096]
// Request frame (stdin):  "C <plen> <glen> <dlen> <npredict> <temp> <seed> <stopnl>\n" + prompt + grammar + draft bytes
//                         "X\n" cancels nothing (single threaded); "Q\n" quits
// Reply (stdout): one JSON line.
#include "../../../android/app/src/main/cpp/molde_core.h"
#include <iostream>

static bool read_exact(std::string & s, size_t n) {
  s.resize(n);
  size_t got = 0;
  while (got < n) { size_t r = fread(&s[got], 1, n - got, stdin); if (r == 0) return false; got += r; }
  return true;
}

int main(int argc, char ** argv) {
  if (argc < 3) { fprintf(stderr, "usage: core_server MODEL LIBDIR [threads] [nctx]\n"); return 2; }
  molde::Core core;
  std::string err = core.load(argv[1], argv[2], argc > 4 ? atoi(argv[4]) : 4096, argc > 3 ? atoi(argv[3]) : 4, false);
  if (!err.empty()) { printf("{\"error\":\"%s\"}\n", molde::json_escape(err).c_str()); return 1; }
  printf("{\"ready\":true}\n"); fflush(stdout);
  char line[256];
  while (fgets(line, sizeof line, stdin)) {
    if (line[0] == 'Q') break;
    if (line[0] != 'C') continue;
    size_t pl, gl, dl; int np, seed, snl; float temp;
    if (sscanf(line + 2, "%zu %zu %zu %d %f %d %d", &pl, &gl, &dl, &np, &temp, &seed, &snl) != 7) break;
    std::string prompt, grammar, draft;
    if (!read_exact(prompt, pl) || !read_exact(grammar, gl) || !read_exact(draft, dl)) break;
    molde::Result r = core.complete(prompt, grammar, np, temp, seed, snl != 0, draft);
    printf("%s\n", molde::to_json(r).c_str()); fflush(stdout);
  }
  return 0;
}
