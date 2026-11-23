// Minimal GBNF acceptance checker using llama.cpp's own grammar engine (libllama).
#include <cstdio>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>
#include <fstream>
#include <sstream>
struct llama_vocab; struct llama_grammar;
struct llama_grammar_element { int type; uint32_t value; };
using stack_t_ = std::vector<const llama_grammar_element*>;
using stacks_t = std::vector<stack_t_>;
llama_grammar* llama_grammar_init_impl(const llama_vocab*, const char*, const char*, bool, const char**, size_t, const int*, size_t);
void llama_grammar_accept(llama_grammar*, uint32_t);
stacks_t& llama_grammar_get_stacks(llama_grammar*);
void llama_grammar_free_impl(llama_grammar*);
static std::string slurp(const char* p){ std::ifstream f(p, std::ios::binary); std::stringstream s; s<<f.rdbuf(); return s.str(); }
static std::vector<uint32_t> utf8(const std::string& s){ std::vector<uint32_t> o; for(size_t i=0;i<s.size();){ unsigned char c=s[i]; uint32_t cp; int n;
 if(c<0x80){cp=c;n=1;} else if((c>>5)==6){cp=c&31;n=2;} else if((c>>4)==14){cp=c&15;n=3;} else {cp=c&7;n=4;}
 for(int k=1;k<n;k++) cp=(cp<<6)|(s[i+k]&63); o.push_back(cp); i+=n;} return o; }
int main(int argc, char** argv){
  if(argc<3){fprintf(stderr,"usage: chk grammar.gbnf file...\n");return 2;}
  std::string g = slurp(argv[1]); int bad=0;
  for(int a=2;a<argc;a++){
    llama_grammar* gr = llama_grammar_init_impl(nullptr, g.c_str(), "root", false, nullptr,0,nullptr,0);
    if(!gr){ printf("GRAMMAR_PARSE_ERROR\n"); return 3; }
    std::string text = slurp(argv[a]); auto cps = utf8(text); size_t pos=0; bool ok=true;
    for(; pos<cps.size(); pos++){ llama_grammar_accept(gr, cps[pos]); if(llama_grammar_get_stacks(gr).empty()){ ok=false; break; } }
    bool done=false; if(ok) for(auto& st: llama_grammar_get_stacks(gr)) if(st.empty()) done=true;
    if(ok && done) printf("ACCEPT %s\n", argv[a]);
    else { bad++; size_t line=1; for(size_t i=0;i<pos && i<cps.size();i++) if(cps[i]=='\n') line++;
      printf("REJECT %s %s at char %zu (line %zu)\n", argv[a], ok?"incomplete":"stuck", pos, line); }
    llama_grammar_free_impl(gr);
  }
  return bad?1:0;
}
