# API Filtrada

Proyecto base de Flask con una pagina de inicio y un endpoint de salud.

## Requisitos

- Python 3.10 o superior

## Instalacion en Windows

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Si PowerShell bloquea la activacion del entorno, ejecuta una vez:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Ejecutar

```powershell
python app.py
```

Abre http://127.0.0.1:5000 en el navegador. El endpoint `GET /health` devuelve:

```json
{"status": "ok"}
```

## Pruebas

```powershell
pytest
```
