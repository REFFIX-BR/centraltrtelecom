# Uso do bot (por argumentos)

```bash
python3 main.py <ação> <login> [extras...]
```

O `<login>` é o PPPoE do cliente (ex.: `20242139`). O bot resolve o IP da ONU via webhook.

Flags opcionais (qualquer comando):

| Flag | Efeito |
|------|--------|
| `--http` | Usa HTTP em vez de HTTPS |
| `-v` / `--verbose` | Logs detalhados |

---

## Ações

| Nº | Ação | Comando |
|----|------|---------|
| 1 | Testar conexão | `python3 main.py "Testar conexão" 20242139` |
| 2 | Rede Wi-Fi | ver abaixo |
| 3 | Checar e corrigir DNS | `python3 main.py "Checar e corrigir DNS" 20242139` |
| 4 | Informações do sistema | `python3 main.py "Informações do sistema" 20242139` |
| 5 | Configurar SIP | `python3 main.py "Configurar SIP" 20242139 <sip> <senha_sip>` |
| 6 | Trocar VLAN | `python3 main.py "Trocar VLAN" 20242139 <vlan>` |
| 7 | Migração | `python3 main.py "Migração" <vlan> <login1> [login2...]` |

Também aceita o número no lugar do nome:

```bash
python3 main.py 4 20242139
python3 main.py 5 20242139 123456 senhaSip
python3 main.py 6 20242139 801
python3 main.py 7 801 20242139 20242140
```

---

## Rede Wi-Fi (ação 2)

```bash
# Só 2.4 GHz
python3 main.py 2 20242139 2g <ssid> <senha>

# Só 5 GHz
python3 main.py 2 20242139 5g <ssid> <senha>

# Ambas
python3 main.py 2 20242139 both <ssid_2g> <senha_2g> <ssid_5g> <senha_5g>
```

---

## Exemplos rápidos

```bash
python3 main.py "Informações do sistema" 20242139
python3 main.py 1 20242139
python3 main.py 3 20242139
python3 main.py 5 20242139 88990011 Abc@123
python3 main.py 6 20242139 850
python3 main.py 7 801 20242139,20242140
```

---

## Menu interativo

Sem args de ação, abre o menu:

```bash
python3 main.py
```
