import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import pandas as pd
import os
import json
import shutil
from datetime import datetime
from pathlib import Path
import re
#ruta
class EvidenciasApp:
    def __init__(self, root):
        self.root = root
        self.root.title("EVIDENCIAS - Sistema de Gestión")
        self.root.geometry("1200x900")
        self.root.configure(bg="#f5f5f5")
        
        # Variables
        self.datos_fuente_path = None
        self.nuevos_datos_path = None
        self.datos_fuente_df = None
        self.nuevos_datos_df = None
        self.total_clientes = 0
        
        # Archivos de sección Gestiones
        self.ivr_base_excel = None
        self.ivr_base_audio = None
        self.ivr_use_for_call = tk.BooleanVar(value=False)
        self.ivr_match_cliente = "CUENTA"
        self.ivr_match_archivo = "CUENTA"
        
        self.sms_base_excel = None
        self.sms_match_cliente = "CUENTA"
        self.sms_match_archivo = "NUMERO DE CREDITO"
        
        self.call_gestiones_excel = None
        self.call_consolidado_excel = None
        self.call_audios_fisicos_path = None
        self.v2_enabled = tk.BooleanVar(value=False)
        
        self.carpeta_salida_path = None
        self.nombre_carpeta_salida = ""
        self.auditor_window_open = False
        
        self.setup_ui()
        
    def setup_ui(self):
        # Frame principal con scrollbar
        main_frame = tk.Frame(self.root, bg="#f5f5f5")
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Canvas para scroll
        canvas = tk.Canvas(main_frame, bg="#f5f5f5", highlightthickness=0)
        scrollbar = ttk.Scrollbar(main_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg="#f5f5f5")
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        # Título
        title_frame = tk.Frame(scrollable_frame, bg="#2c3e50", relief=tk.RAISED, bd=2)
        title_frame.pack(fill=tk.X, pady=(0, 15))
        
        title_label = tk.Label(
            title_frame,
            text="📋 EVIDENCIAS",
            font=("Arial", 24, "bold"),
            bg="#2c3e50",
            fg="white",
            pady=15
        )
        title_label.pack()
        
        # SECCIÓN BASE
        base_section = self.create_section(scrollable_frame, "📊 SECCIÓN BASE")
        
        # Nombre cliente + cuenta
        cliente_frame = tk.Frame(base_section, bg="#ecf0f1", pady=10, padx=10)
        cliente_frame.pack(fill=tk.X, pady=5)
        
        tk.Label(
            cliente_frame,
            text="Clientes:",
            font=("Arial", 11, "bold"),
            bg="#ecf0f1"
        ).pack(side=tk.LEFT, padx=5)
        
        self.clientes_entry = tk.Entry(cliente_frame, width=15, font=("Arial", 11))
        self.clientes_entry.pack(side=tk.LEFT, padx=5)
        self.clientes_entry.insert(0, "0")
        self.clientes_entry.config(state="readonly")
        
        tk.Label(
            cliente_frame,
            text="carpetas a crear",
            font=("Arial", 11),
            bg="#ecf0f1"
        ).pack(side=tk.LEFT, padx=5)
        
        # Datos fuente
        self.datos_fuente_frame = self.create_file_selector(
            base_section,
            "Datos fuente:",
            "datos_fuente.xlsx",
            self.select_datos_fuente,
            self.datos_fuente_path
        )
        
        # Nuevos datos
        self.nuevos_datos_frame = self.create_file_selector(
            base_section,
            "Nuevos Datos:",
            "nuevos_datos.xlsx",
            self.select_nuevos_datos,
            self.nuevos_datos_path
        )
        self.nuevos_datos_frame.state = "disabled"
        
        # Fechas
        fecha_frame = tk.Frame(base_section, bg="#ecf0f1", pady=10, padx=10)
        fecha_frame.pack(fill=tk.X, pady=5)
        
        tk.Label(fecha_frame, text="Fecha inicio:", font=("Arial", 10), bg="#ecf0f1").pack(side=tk.LEFT, padx=5)
        self.fecha_inicio = tk.Entry(fecha_frame, width=12)
        self.fecha_inicio.insert(0, "20/10/2025")
        self.fecha_inicio.pack(side=tk.LEFT, padx=5)
        
        tk.Label(fecha_frame, text="Fecha Fin:", font=("Arial", 10), bg="#ecf0f1").pack(side=tk.LEFT, padx=5)
        self.fecha_fin = tk.Entry(fecha_frame, width=12)
        self.fecha_fin.insert(0, "24/10/2025")
        self.fecha_fin.pack(side=tk.LEFT, padx=5)
        
        self.probar_coincidencia_btn = tk.Button(
            fecha_frame,
            text="🔍 Probar Coincidencia",
            command=self.probar_coincidencia,
            bg="#3498db",
            fg="white",
            font=("Arial", 10, "bold"),
            state="disabled",
            cursor="hand2"
        )
        self.probar_coincidencia_btn.pack(side=tk.LEFT, padx=10)
        
        # SECCIÓN GESTIONES
        gestiones_section = self.create_section(scrollable_frame, "⚙️ SECCIÓN GESTIONES")
        
        # IVR
        ivr_frame = self.create_gestion_frame(
            gestiones_section,
            "📞 IVR",
            "[nombre de cliente]ivr.xlsx",
            "ivr[nombre del cliente].mp3"
        )
        
        self.ivr_base_excel_frame = self.create_file_selector(
            ivr_frame,
            "archivo base:",
            "archivo base.xlsx",
            self.select_ivr_base_excel,
            self.ivr_base_excel
        )
        
        self.ivr_base_audio_frame = self.create_file_selector(
            ivr_frame,
            "audio base:",
            "audio base.mp3",
            self.select_ivr_base_audio,
            self.ivr_base_audio,
            filetypes=[("MP3 files", "*.mp3")]
        )
        
        # Checkbox usar mismo archivo para CALL
        checkbox_frame = tk.Frame(ivr_frame, bg="#ecf0f1")
        checkbox_frame.pack(fill=tk.X, pady=5)
        checkbox_v2_ivr = tk.Checkbutton(
            checkbox_frame,
            text="✅ El mismo para gestión CALL",
            variable=self.ivr_use_for_call,
            bg="#ecf0f1",
            font=("Arial", 9),
            cursor="hand2",
            command=self.toggle_call_gestiones_selector
        )
        checkbox_v2_ivr.pack(side=tk.LEFT)
        
        # Match IVR
        match_frame = tk.Frame(ivr_frame, bg="#ecf0f1", pady=5)
        match_frame.pack(fill=tk.X)
        
        tk.Label(match_frame, text="CLIENTE:", bg="#ecf0f1", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        self.ivr_match_cliente_combo = ttk.Combobox(match_frame, width=15, values=["CUENTA", "TELEFONO", "DNI"])
        self.ivr_match_cliente_combo.pack(side=tk.LEFT, padx=5)
        self.ivr_match_cliente_combo.set("CUENTA")
        
        tk.Label(match_frame, text="match", bg="#ecf0f1", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        
        self.ivr_match_archivo_combo = ttk.Combobox(match_frame, width=15, values=["CUENTA", "TELEFONO", "DNI"])
        self.ivr_match_archivo_combo.pack(side=tk.LEFT, padx=5)
        self.ivr_match_archivo_combo.set("CUENTA")
        
        tk.Label(match_frame, text="archivo base", bg="#ecf0f1", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        
        # SMS
        sms_frame = self.create_gestion_frame(
            gestiones_section,
            "💬 SMS",
            "SMS_[nombre de cliente].xlsx"
        )
        
        self.sms_base_excel_frame = self.create_file_selector(
            sms_frame,
            "archivo base:",
            "sms.xlsx",
            self.select_sms_base_excel,
            self.sms_base_excel
        )
        
        # Match SMS
        match_sms_frame = tk.Frame(sms_frame, bg="#ecf0f1", pady=5)
        match_sms_frame.pack(fill=tk.X)
        
        tk.Label(match_sms_frame, text="CLIENTE:", bg="#ecf0f1", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        self.sms_match_cliente_combo = ttk.Combobox(match_sms_frame, width=15, values=["CUENTA", "TELEFONO", "DNI"])
        self.sms_match_cliente_combo.pack(side=tk.LEFT, padx=5)
        self.sms_match_cliente_combo.set("CUENTA")
        
        tk.Label(match_sms_frame, text="match", bg="#ecf0f1", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        
        self.sms_match_archivo_combo = ttk.Combobox(match_sms_frame, width=15, values=["NUMERO DE CREDITO", "CUENTA", "TELEFONO"])
        self.sms_match_archivo_combo.pack(side=tk.LEFT, padx=5)
        self.sms_match_archivo_combo.set("NUMERO DE CREDITO")
        
        tk.Label(match_sms_frame, text="archivo base", bg="#ecf0f1", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        
        # CALL
        call_frame = self.create_gestion_frame(
            gestiones_section,
            "📞 CALL",
            "[nombre de cliente]_gestiones.xlsx",
            "[nombre de cliente]_[cuenta del cliente].mp3"
        )
        
        self.call_gestiones_frame = self.create_file_selector(
            call_frame,
            "archivo gestiones:",
            "nuevos_datos.xlsx",
            self.select_call_gestiones_excel,
            self.call_gestiones_excel
        )
        
        self.call_consolidado_frame = self.create_file_selector(
            call_frame,
            "archivo call:",
            "reporte_consolidado.xlsx",
            self.select_call_consolidado_excel,
            self.call_consolidado_excel
        )
        
        # Botón para limpiar selección de call consolidado
        btn_limpiar_call = tk.Button(
            call_frame,
            text="🗑️ Limpiar",
            command=self.limpiar_call_consolidado,
            bg="#e74c3c",
            fg="white",
            font=("Arial", 8),
            cursor="hand2",
            padx=5
        )
        btn_limpiar_call.pack(side=tk.LEFT, padx=5)
        
        # Audios físicos
        self.call_audios_fisicos_frame = self.create_file_selector(
            call_frame,
            "✅ audios físicos:",
            "carpetas",
            self.select_call_audios_fisicos,
            self.call_audios_fisicos_path,
            is_directory=True
        )
        
        
        # Checkbox V2 (separado de las gestiones)
        v2_section = tk.Frame(scrollable_frame, bg="#ecf0f1", pady=10, padx=10, relief=tk.RAISED, bd=2)
        v2_section.pack(fill=tk.X, pady=10)
        
        tk.Label(
            v2_section,
            text="⚙️ CONFIGURACIÓN V2",
            font=("Arial", 12, "bold"),
            bg="#ecf0f1",
            fg="#2c3e50"
        ).pack(anchor=tk.W, pady=5)
        
        v2_frame = tk.Frame(v2_section, bg="#ecf0f1", pady=5)
        v2_frame.pack(fill=tk.X)
        
        checkbox_v2 = tk.Checkbutton(
            v2_frame,
            text="✅ V2. Combinar gestiones de datos_fuente.xlsx y nuevos_datos.xlsx (eliminando duplicados)",
            variable=self.v2_enabled,
            bg="#ecf0f1",
            font=("Arial", 10),
            cursor="hand2",
            wraplength=800
        )
        checkbox_v2.pack(side=tk.LEFT)
        
        tk.Label(
            v2_frame,
            text="\nSi está activo, combina las gestiones de ambos archivos.\nEjemplo: Si datos_fuente tiene 'IVR,SMS' y nuevos_datos tiene 'IVR,SMS,CALL',\nresultado final será 'IVR, SMS, CALL' (sin duplicados).",
            bg="#ecf0f1",
            font=("Arial", 8),
            fg="#7f8c8d",
            justify=tk.LEFT
        ).pack(side=tk.LEFT, padx=10)
        
        # Carpeta de salida
        salida_frame = tk.Frame(scrollable_frame, bg="#ecf0f1", pady=10, padx=10, relief=tk.RAISED, bd=2)
        salida_frame.pack(fill=tk.X, pady=15)
        
        tk.Label(
            salida_frame,
            text="📁 CARPETA DE SALIDA:",
            font=("Arial", 12, "bold"),
            bg="#ecf0f1"
        ).pack(side=tk.LEFT, padx=10)
        
        self.carpeta_salida_entry = tk.Entry(salida_frame, width=50, font=("Arial", 10))
        self.carpeta_salida_entry.pack(side=tk.LEFT, padx=5)
        
        tk.Button(
            salida_frame,
            text="📂 Seleccionar",
            command=self.select_carpeta_salida,
            bg="#95a5a6",
            fg="white",
            font=("Arial", 9),
            cursor="hand2"
        ).pack(side=tk.LEFT, padx=5)
        
        # Nombre de carpeta
        nombre_frame = tk.Frame(salida_frame, bg="#ecf0f1")
        nombre_frame.pack(side=tk.LEFT, padx=10)
        
        tk.Label(nombre_frame, text="Nombre:", bg="#ecf0f1", font=("Arial", 9)).pack(side=tk.LEFT)
        self.nombre_carpeta_entry = tk.Entry(nombre_frame, width=20, font=("Arial", 9))
        self.nombre_carpeta_entry.pack(side=tk.LEFT, padx=5)
        self.nombre_carpeta_entry.insert(0, datetime.now().strftime("evidencias_%d-%m-%y"))
        
        # Botón ejecutar
        ejecutar_frame = tk.Frame(scrollable_frame, bg="#f5f5f5", pady=20)
        ejecutar_frame.pack(fill=tk.X)
        
        self.ejecutar_btn = tk.Button(
            ejecutar_frame,
            text="🚀 EJECUTAR PROCESO ✅",
            command=self.ejecutar_proceso,
            bg="#27ae60",
            fg="white",
            font=("Arial", 14, "bold"),
            pady=10,
            cursor="hand2",
            state="disabled"
        )
        self.ejecutar_btn.pack(side=tk.LEFT, padx=10)
        
        tk.Button(
            ejecutar_frame,
            text="📊 Simular Resultado",
            command=self.simular_resultado,
            bg="#e67e22",
            fg="white",
            font=("Arial", 11, "bold"),
            pady=8,
            cursor="hand2"
        ).pack(side=tk.LEFT, padx=10)
        
        # LOGS
        logs_section = tk.Frame(scrollable_frame, bg="#ecf0f1", pady=10, padx=10, relief=tk.RAISED, bd=2)
        logs_section.pack(fill=tk.BOTH, expand=True, pady=15)
        
        tk.Label(
            logs_section,
            text="📋 LOGS",
            font=("Arial", 12, "bold"),
            bg="#ecf0f1"
        ).pack(anchor=tk.W)
        
        self.logs_text = scrolledtext.ScrolledText(
            logs_section,
            height=10,
            font=("Consolas", 9),
            bg="#2c3e50",
            fg="#ecf0f1",
            wrap=tk.WORD
        )
        self.logs_text.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # Progress bar
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(
            logs_section,
            variable=self.progress_var,
            maximum=100,
            length=400
        )
        self.progress_bar.pack(pady=5)
        
        # Botón auditor
        auditor_btn = tk.Button(
            logs_section,
            text="🔍 EJECUTAR AUDITOR",
            command=self.ejecutar_auditor,
            bg="#8e44ad",
            fg="white",
            font=("Arial", 11, "bold"),
            pady=8,
            cursor="hand2"
        )
        auditor_btn.pack(pady=10)
        
        # Configurar canvas scrolling
        canvas.bind_all("<MouseWheel>", lambda e: canvas.yview_scroll(int(-1*(e.delta/120)), "units"))
        
    def create_section(self, parent, title):
        frame = tk.Frame(parent, bg="#ecf0f1", relief=tk.RAISED, bd=2, pady=10, padx=10)
        frame.pack(fill=tk.X, pady=10)
        
        title_label = tk.Label(
            frame,
            text=title,
            font=("Arial", 14, "bold"),
            bg="#34495e",
            fg="white",
            pady=8
        )
        title_label.pack(fill=tk.X)
        
        content_frame = tk.Frame(frame, bg="#ecf0f1")
        content_frame.pack(fill=tk.X, padx=5, pady=5)
        
        return content_frame
        
    def create_gestion_frame(self, parent, title, archivo1, archivo2=None):
        frame = tk.Frame(parent, bg="#ecf0f1", relief=tk.SUNKEN, bd=1, pady=8, padx=8)
        frame.pack(fill=tk.X, pady=5)
        
        tk.Label(
            frame,
            text=f"{title}: {archivo1}",
            font=("Arial", 11, "bold"),
            bg="#ecf0f1"
        ).pack(anchor=tk.W)
        
        if archivo2:
            tk.Label(
                frame,
                text=archivo2,
                font=("Arial", 10),
                bg="#ecf0f1",
                fg="#7f8c8d"
            ).pack(anchor=tk.W)
        
        return frame
        
    def create_file_selector(self, parent, label, placeholder, command, current_value, filetypes=None, is_directory=False):
        frame = tk.Frame(parent, bg="#ecf0f1", pady=5)
        frame.pack(fill=tk.X)
        
        tk.Label(frame, text=label, font=("Arial", 10), bg="#ecf0f1").pack(side=tk.LEFT, padx=5)
        
        entry = tk.Entry(frame, width=50, font=("Arial", 9))
        entry.pack(side=tk.LEFT, padx=5)
        entry.insert(0, placeholder)
        entry.config(state="readonly", bg="#ffffff")
        frame.entry = entry
        
        btn = tk.Button(
            frame,
            text="📂 Seleccionar",
            command=command,
            bg="#3498db",
            fg="white",
            font=("Arial", 8),
            cursor="hand2",
            padx=5
        )
        btn.pack(side=tk.LEFT, padx=5)
        
        frame.btn = btn
        frame.state = "normal"
        frame.file_path = None
        
        def update_selected(file_path):
            """Actualiza el estado cuando se selecciona un archivo"""
            frame.file_path = file_path
            entry.config(state="normal", bg="#d4edda")
            entry.delete(0, tk.END)
            entry.insert(0, os.path.basename(file_path) if file_path else placeholder)
            entry.config(state="readonly")
            btn.config(text="✅ Seleccionado", bg="#28a745", state="normal")
        
        def disable():
            entry.config(state="normal", bg="#f8d7da")
            entry.delete(0, tk.END)
            entry.insert(0, "Deshabilitado")
            entry.config(state="readonly")
            btn.config(state="disabled", text="📂 Seleccionar", bg="#3498db")
            frame.state = "disabled"
            
        def enable():
            entry.config(state="normal", bg="#ffffff")
            entry.delete(0, tk.END)
            entry.insert(0, placeholder)
            entry.config(state="readonly")
            btn.config(state="normal", text="📂 Seleccionar", bg="#3498db")
            frame.state = "normal"
        
        frame.disable = disable
        frame.enable = enable
        frame.update_selected = update_selected
        
        return frame
        
    def select_datos_fuente(self):
        file_path = filedialog.askopenfilename(
            title="Seleccionar datos_fuente.xlsx",
            filetypes=[("Excel files", "*.xlsx *.xls")]
        )
        if file_path:
            self.datos_fuente_path = file_path
            try:
                self.datos_fuente_df = pd.read_excel(file_path)
                self.total_clientes = len(self.datos_fuente_df)
                
                # Actualizar entrada de clientes
                if hasattr(self, 'clientes_entry'):
                    self.clientes_entry.config(state="normal")
                    self.clientes_entry.delete(0, tk.END)
                    self.clientes_entry.insert(0, str(self.total_clientes))
                    self.clientes_entry.config(state="readonly")
                
                # Habilitar selector de nuevos datos
                if hasattr(self, 'nuevos_datos_frame'):
                    self.nuevos_datos_frame.enable()
                
                # Habilitar botón ejecutar si hay carpeta de salida
                if hasattr(self, 'ejecutar_btn') and self.carpeta_salida_path:
                    self.ejecutar_btn.config(state="normal")
                
                # Actualizar estado visual del selector
                if hasattr(self, 'datos_fuente_frame'):
                    self.datos_fuente_frame.update_selected(file_path)
                
                self.log(f"✅ Datos fuente cargados: {self.total_clientes} clientes encontrados")
            except Exception as e:
                messagebox.showerror("Error", f"Error al cargar archivo: {str(e)}")
                
    def select_nuevos_datos(self):
        file_path = filedialog.askopenfilename(
            title="Seleccionar nuevos_datos.xlsx",
            filetypes=[("Excel files", "*.xlsx *.xls")]
        )
        if file_path:
            self.nuevos_datos_path = file_path
            try:
                self.nuevos_datos_df = pd.read_excel(file_path)
                self.probar_coincidencia_btn.config(state="normal")
                if hasattr(self, 'nuevos_datos_frame'):
                    self.nuevos_datos_frame.update_selected(file_path)
                self.log(f"✅ Nuevos datos cargados: {len(self.nuevos_datos_df)} registros")
            except Exception as e:
                messagebox.showerror("Error", f"Error al cargar archivo: {str(e)}")
    
    def probar_coincidencia(self):
        if self.datos_fuente_df is None or self.nuevos_datos_df is None:
            messagebox.showwarning("Advertencia", "Debe cargar ambos archivos primero")
            return
            
        no_coinciden = []
        
        # Normalizar nombres de columnas
        gestion_efectiva_col = None
        cuenta_fuente_col = None
        
        for col in self.datos_fuente_df.columns:
            if "GESTION EFECTIVA" in str(col).upper():
                gestion_efectiva_col = col
            if "CUENTA" in str(col).upper():
                cuenta_fuente_col = col
        
        tipo_gestion_col = None
        cuenta_nuevos_col = None
        
        for col in self.nuevos_datos_df.columns:
            if "TIPO DE GESTION" in str(col).upper() or "TIPO GESTION" in str(col).upper():
                tipo_gestion_col = col
            if "CUENTA" in str(col).upper():
                cuenta_nuevos_col = col
        
        if not gestion_efectiva_col or not cuenta_fuente_col or not tipo_gestion_col or not cuenta_nuevos_col:
            messagebox.showerror("Error", "No se encontraron las columnas necesarias en los archivos")
            return
        
        # Buscar coincidencias
        for idx, row_fuente in self.datos_fuente_df.iterrows():
            cuenta_fuente = str(row_fuente[cuenta_fuente_col]).strip()
            gestion_fuente = str(row_fuente[gestion_efectiva_col]).strip()
            
            # Buscar en nuevos datos
            matches = self.nuevos_datos_df[self.nuevos_datos_df[cuenta_nuevos_col].astype(str).str.strip() == cuenta_fuente]
            
            if len(matches) > 0:
                gestion_nueva = str(matches.iloc[0][tipo_gestion_col]).strip()
                
                # Normalizar gestiones (CALL = GRABACION CALL)
                gestion_fuente_norm = gestion_fuente.replace("GRABACION CALL", "CALL").replace("GRABACIÓN CALL", "CALL")
                gestion_nueva_norm = gestion_nueva.replace("GRABACION CALL", "CALL").replace("GRABACIÓN CALL", "CALL")
                
                # Verificar si hay diferencias
                gestiones_fuente = [g.strip() for g in gestion_fuente_norm.split(",")]
                gestiones_nueva = [g.strip() for g in gestion_nueva_norm.split(",")]
                
                if set(gestiones_fuente) != set(gestiones_nueva):
                    nombre_cliente = str(row_fuente.get("NOMBRE", row_fuente.get("CLIENTE", "N/A"))).strip()
                    no_coinciden.append({
                        "id": len(no_coinciden) + 1,
                        "cuenta": cuenta_fuente,
                        "nombre": nombre_cliente,
                        "datos_fuente": gestion_fuente,
                        "nuevos_datos": gestion_nueva
                    })
        
        if no_coinciden:
            self.mostrar_no_coincidencias(no_coinciden)
        else:
            messagebox.showinfo("Coincidencia", "✅ Todas las gestiones coinciden correctamente")
    
    def mostrar_no_coincidencias(self, no_coinciden):
        window = tk.Toplevel(self.root)
        window.title("Clientes que no coinciden")
        window.geometry("800x500")
        window.configure(bg="#ecf0f1")
        
        # Frame con scrollbar
        frame = tk.Frame(window, bg="#ecf0f1")
        frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Headers
        headers = ["ID", "CUENTA", "NOMBRE", "DATOS_FUENTE", "NUEVOS_DATOS"]
        for i, header in enumerate(headers):
            label = tk.Label(
                frame,
                text=header,
                font=("Arial", 10, "bold"),
                bg="#34495e",
                fg="white",
                width=20,
                padx=5
            )
            label.grid(row=0, column=i, sticky="ew", padx=2, pady=2)
        
        # Data
        for idx, item in enumerate(no_coinciden, 1):
            tk.Label(frame, text=str(item["id"]), bg="#ecf0f1", width=20).grid(row=idx, column=0, padx=2, pady=2)
            tk.Label(frame, text=item["cuenta"], bg="#ecf0f1", width=20).grid(row=idx, column=1, padx=2, pady=2)
            tk.Label(frame, text=item["nombre"][:30], bg="#ecf0f1", width=20).grid(row=idx, column=2, padx=2, pady=2)
            tk.Label(frame, text=item["datos_fuente"][:30], bg="#ecf0f1", width=20).grid(row=idx, column=3, padx=2, pady=2)
            tk.Label(frame, text=item["nuevos_datos"][:30], bg="#ecf0f1", width=20).grid(row=idx, column=4, padx=2, pady=2)
        
        frame.columnconfigure(0, weight=1)
        frame.columnconfigure(1, weight=1)
        frame.columnconfigure(2, weight=1)
        frame.columnconfigure(3, weight=1)
        frame.columnconfigure(4, weight=1)
    
    def select_ivr_base_excel(self):
        file_path = filedialog.askopenfilename(
            title="Seleccionar archivo base IVR",
            filetypes=[("Excel files", "*.xlsx *.xls")]
        )
        if file_path:
            self.ivr_base_excel = file_path
            if hasattr(self, 'ivr_base_excel_frame'):
                self.ivr_base_excel_frame.update_selected(file_path)
            
            # Si el checkbox IVR para CALL está activo, actualizar estado visual
            if self.ivr_use_for_call.get() and hasattr(self, 'call_gestiones_frame'):
                self.call_gestiones_frame.btn.config(text="✅ Seleccionado (IVR)", bg="#28a745", state="normal")
            
            self.log(f"✅ Archivo base IVR seleccionado: {os.path.basename(file_path)}")
    
    def select_ivr_base_audio(self):
        file_path = filedialog.askopenfilename(
            title="Seleccionar audio base IVR",
            filetypes=[("MP3 files", "*.mp3")]
        )
        if file_path and file_path.lower().endswith('.mp3'):
            self.ivr_base_audio = file_path
            if hasattr(self, 'ivr_base_audio_frame'):
                self.ivr_base_audio_frame.update_selected(file_path)
            self.log(f"✅ Audio base IVR seleccionado: {os.path.basename(file_path)}")
        else:
            messagebox.showerror("Error", "Debe seleccionar un archivo MP3")
    
    def select_sms_base_excel(self):
        file_path = filedialog.askopenfilename(
            title="Seleccionar archivo base SMS",
            filetypes=[("Excel files", "*.xlsx *.xls")]
        )
        if file_path:
            self.sms_base_excel = file_path
            if hasattr(self, 'sms_base_excel_frame'):
                self.sms_base_excel_frame.update_selected(file_path)
            self.log(f"✅ Archivo base SMS seleccionado: {os.path.basename(file_path)}")
    
    def select_call_gestiones_excel(self):
        if self.ivr_use_for_call.get():
            messagebox.showinfo("Información", "El archivo de gestiones CALL usará el mismo archivo base IVR")
            return
        file_path = filedialog.askopenfilename(
            title="Seleccionar archivo gestiones CALL",
            filetypes=[("Excel files", "*.xlsx *.xls")]
        )
        if file_path:
            self.call_gestiones_excel = file_path
            if hasattr(self, 'call_gestiones_frame'):
                self.call_gestiones_frame.update_selected(file_path)
            self.log(f"✅ Archivo gestiones CALL seleccionado: {os.path.basename(file_path)}")
    
    def select_call_consolidado_excel(self):
        file_path = filedialog.askopenfilename(
            title="Seleccionar reporte consolidado CALL",
            filetypes=[("Excel files", "*.xlsx *.xls")]
        )
        if file_path:
            self.call_consolidado_excel = file_path
            if hasattr(self, 'call_consolidado_frame'):
                self.call_consolidado_frame.update_selected(file_path)
            
            # Deshabilitar selector de audios físicos cuando se selecciona archivo call
            if hasattr(self, 'call_audios_fisicos_frame'):
                self.call_audios_fisicos_frame.disable()
                self.call_audios_fisicos_frame.entry.config(state="normal")
                self.call_audios_fisicos_frame.entry.delete(0, tk.END)
                self.call_audios_fisicos_frame.entry.insert(0, "Los audios se buscarán en el archivo call")
                self.call_audios_fisicos_frame.entry.config(state="readonly", bg="#fff3cd")
                self.call_audios_fisicos_path = None  # Limpiar path ya que no se usará
            
            self.log(f"✅ Reporte consolidado CALL seleccionado: {os.path.basename(file_path)}")
    
    def limpiar_call_consolidado(self):
        """Permite limpiar la selección del archivo call consolidado para habilitar audios físicos"""
        if hasattr(self, 'call_consolidado_frame'):
            self.call_consolidado_excel = None
            self.call_consolidado_frame.entry.config(state="normal")
            self.call_consolidado_frame.entry.delete(0, tk.END)
            self.call_consolidado_frame.entry.insert(0, "reporte_consolidado.xlsx")
            self.call_consolidado_frame.entry.config(state="readonly", bg="white")
            self.call_consolidado_frame.btn.config(text="📂 Seleccionar", bg="#3498db", state="normal")
            
            # Re-habilitar selector de audios físicos
            if hasattr(self, 'call_audios_fisicos_frame'):
                self.call_audios_fisicos_frame.enable()
                self.call_audios_fisicos_frame.entry.config(state="normal")
                self.call_audios_fisicos_frame.entry.delete(0, tk.END)
                self.call_audios_fisicos_frame.entry.insert(0, "carpetas")
                self.call_audios_fisicos_frame.entry.config(state="readonly", bg="white")
            
            self.log("🗑️ Selección de archivo call consolidado limpiada")
    
    def toggle_call_gestiones_selector(self):
        """Habilita/deshabilita el selector de gestiones CALL según el checkbox IVR"""
        if hasattr(self, 'call_gestiones_frame'):
            if self.ivr_use_for_call.get():
                self.call_gestiones_frame.disable()
                self.call_gestiones_frame.entry.config(state="normal")
                self.call_gestiones_frame.entry.delete(0, tk.END)
                self.call_gestiones_frame.entry.insert(0, "Usará el mismo archivo base IVR")
                self.call_gestiones_frame.entry.config(state="readonly", bg="#fff3cd")
                # Actualizar estado visual para mostrar como seleccionado
                self.call_gestiones_frame.btn.config(text="✅ Seleccionado (IVR)", bg="#28a745", state="normal")
            else:
                self.call_gestiones_frame.enable()
                # Si había sido deshabilitado por el checkbox, restaurar estado normal
                if self.call_gestiones_excel:
                    self.call_gestiones_frame.update_selected(self.call_gestiones_excel)
                else:
                    self.call_gestiones_frame.btn.config(text="📂 Seleccionar", bg="#3498db")
    
    def select_call_audios_fisicos(self):
        dir_path = filedialog.askdirectory(title="Seleccionar carpeta de audios físicos")
        if dir_path:
            self.call_audios_fisicos_path = dir_path
            if hasattr(self, 'call_audios_fisicos_frame'):
                self.call_audios_fisicos_frame.update_selected(dir_path)
            self.log(f"✅ Carpeta de audios físicos seleccionada: {dir_path}")
    
    def select_carpeta_salida(self):
        dir_path = filedialog.askdirectory(title="Seleccionar carpeta de salida")
        if dir_path:
            self.carpeta_salida_path = dir_path
            self.carpeta_salida_entry.delete(0, tk.END)
            self.carpeta_salida_entry.insert(0, dir_path)
            
            # Habilitar botón ejecutar si hay datos fuente
            if hasattr(self, 'ejecutar_btn') and self.datos_fuente_df is not None:
                self.ejecutar_btn.config(state="normal")
            
            self.log(f"✅ Carpeta de salida seleccionada: {dir_path}")
    
    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.logs_text.insert(tk.END, f"[{timestamp}] {message}\n")
        self.logs_text.see(tk.END)
        self.root.update()
    
    def ejecutar_proceso(self):
        if not self.validar_datos():
            return
        
        self.log("🚀 Iniciando proceso de generación de evidencias...")
        self.ejecutar_btn.config(state="disabled")
        
        try:
            # Crear carpeta principal
            if hasattr(self, 'nombre_carpeta_entry') and self.nombre_carpeta_entry.get():
                nombre_carpeta = self.nombre_carpeta_entry.get()
            else:
                nombre_carpeta = datetime.now().strftime("evidencias_%d-%m-%y")
            
            carpeta_principal = os.path.join(self.carpeta_salida_path, nombre_carpeta)
            os.makedirs(carpeta_principal, exist_ok=True)
            
            self.log(f"📁 Carpeta principal creada: {carpeta_principal}")
            
            total = len(self.datos_fuente_df)
            
            for idx, cliente_row in self.datos_fuente_df.iterrows():
                try:
                    self.procesar_cliente(cliente_row, carpeta_principal)
                    progress = ((idx + 1) / total) * 100
                    self.progress_var.set(progress)
                    if (idx + 1) % 10 == 0:  # Log cada 10 clientes
                        self.log(f"Procesado {idx + 1}/{total} - {progress:.1f}%")
                    self.root.update()
                except Exception as e:
                    self.log(f"❌ Error procesando cliente {idx + 1}: {str(e)}")
            
            self.progress_var.set(100)
            self.log("✅ Proceso completado exitosamente")
            messagebox.showinfo("Éxito", f"Proceso completado exitosamente.\nTotal de carpetas creadas: {total}")
            
        except Exception as e:
            self.log(f"❌ Error en el proceso: {str(e)}")
            messagebox.showerror("Error", f"Error en el proceso: {str(e)}")
        finally:
            self.ejecutar_btn.config(state="normal")
    
    def validar_datos(self):
        if self.datos_fuente_df is None:
            messagebox.showerror("Error", "Debe cargar datos_fuente.xlsx")
            return False
        if not self.carpeta_salida_path:
            messagebox.showerror("Error", "Debe seleccionar carpeta de salida")
            return False
        return True
    
    def procesar_cliente(self, cliente_row, carpeta_principal):
        # Obtener datos del cliente
        nombre_cliente = str(cliente_row.get("NOMBRE", cliente_row.get("CLIENTE", "Sin nombre"))).strip()
        cuenta_cliente = str(cliente_row.get("CUENTA", "")).strip()
        gestion_efectiva = str(cliente_row.get("GESTION EFECTIVA", "")).strip()
        
        # Normalizar gestiones (siempre a mayúsculas y sin GRABACION CALL)
        gestiones = [g.strip().upper().replace("GRABACION CALL", "CALL").replace("GRABACIÓN CALL", "CALL") 
                     for g in gestion_efectiva.split(",") if g.strip()]
        
        # Si V2 está activo, combinar gestiones de datos_fuente y nuevos_datos (sin duplicados)
        if self.v2_enabled.get() and self.nuevos_datos_df is not None:
            gestiones = self.obtener_gestiones_v2(cuenta_cliente, gestiones)
        
        # Crear carpeta del cliente
        nombre_carpeta_cliente = f"{nombre_cliente}_{cuenta_cliente}"
        nombre_carpeta_cliente = self.sanitize_filename(nombre_carpeta_cliente)
        carpeta_cliente = os.path.join(carpeta_principal, nombre_carpeta_cliente)
        os.makedirs(carpeta_cliente, exist_ok=True)
        
        # Debug: Log de gestiones para este cliente
        gestiones_str = ', '.join(gestiones) if gestiones else 'NINGUNA'
        self.log(f"  🔍 Cliente: {nombre_cliente} | Gestiones: {gestiones_str}")
        
        # Orden de procesamiento: IVR → SMS → CALL (sin importar el orden original)
        orden_procesamiento = ["IVR", "SMS", "CALL"]
        
        # Procesar cada gestión en el orden correcto (sin detenerse si una falla)
        for gestion_ordenada in orden_procesamiento:
            if gestion_ordenada in gestiones:
                try:
                    if gestion_ordenada == "IVR":
                        self.procesar_ivr(cliente_row, carpeta_cliente, nombre_cliente)
                    elif gestion_ordenada == "SMS":
                        self.procesar_sms(cliente_row, carpeta_cliente, nombre_cliente)
                    elif gestion_ordenada == "CALL":
                        self.procesar_call(cliente_row, carpeta_cliente, nombre_cliente, cuenta_cliente)
                except Exception as e:
                    self.log(f"  ❌ Error procesando gestión {gestion_ordenada} para {nombre_cliente}: {str(e)}")
                    # Continuar con la siguiente gestión sin detener el proceso
    
    def obtener_gestiones_v2(self, cuenta_cliente, gestiones_actuales):
        """Combina gestiones de datos_fuente y nuevos_datos eliminando duplicados"""
        if self.nuevos_datos_df is None:
            self.log(f"    ⚠️ V2: nuevos_datos_df no está cargado")
            return gestiones_actuales
        
        # Buscar cliente en nuevos_datos por CUENTA
        cuenta_col = None
        tipo_gestion_col = None
        
        for col in self.nuevos_datos_df.columns:
            if "CUENTA" in str(col).upper():
                cuenta_col = col
            if "TIPO DE GESTION" in str(col).upper() or "TIPO GESTION" in str(col).upper():
                tipo_gestion_col = col
        
        if not cuenta_col or not tipo_gestion_col:
            self.log(f"    ⚠️ V2: Columnas no encontradas - CUENTA: {cuenta_col}, TIPO_GESTION: {tipo_gestion_col}")
            return gestiones_actuales
        
        # Normalizar gestiones actuales
        gestiones_actuales_norm = [g.strip().upper().replace("GRABACION CALL", "CALL").replace("GRABACIÓN CALL", "CALL") 
                                   for g in gestiones_actuales if g.strip()]
        
        # Buscar todas las filas que coincidan con la cuenta
        cuenta_buscar = str(cuenta_cliente).strip()
        matches = self.nuevos_datos_df[
            self.nuevos_datos_df[cuenta_col].astype(str).str.strip() == cuenta_buscar
        ]
        
        nuevas_gestiones_list = []
        
        if len(matches) > 0:
            # Obtener gestiones de todas las filas coincidentes
            for _, row in matches.iterrows():
                tipo_gestion = str(row[tipo_gestion_col]).strip()
                if tipo_gestion and tipo_gestion.upper() != "NAN" and tipo_gestion.upper() != "NONE":
                    nuevas_gestiones = [g.strip().upper().replace("GRABACION CALL", "CALL").replace("GRABACIÓN CALL", "CALL") 
                                       for g in tipo_gestion.split(",") if g.strip()]
                    nuevas_gestiones_list.extend(nuevas_gestiones)
        else:
            self.log(f"    ⚠️ V2: No se encontró cuenta {cuenta_buscar} en nuevos_datos")
        
        # Combinar ambas listas y eliminar duplicados (case-insensitive)
        todas_gestiones_set = set()
        
        # Agregar gestiones actuales
        for gest in gestiones_actuales_norm:
            todas_gestiones_set.add(gest.upper())
        
        # Agregar nuevas gestiones
        for gest in nuevas_gestiones_list:
            todas_gestiones_set.add(gest.upper())
        
        # Convertir a lista ordenada (mantener orden: IVR, SMS, CALL primero)
        orden_preferido = ["IVR", "SMS", "CALL", "WHATSAPP", "EMAIL", "OTROS"]
        todas_gestiones = []
        
        # Primero agregar en orden preferido
        for gest_pref in orden_preferido:
            if gest_pref in todas_gestiones_set:
                todas_gestiones.append(gest_pref)
                todas_gestiones_set.remove(gest_pref)
        
        # Luego agregar las que quedan
        todas_gestiones.extend(sorted(todas_gestiones_set))
        
        if len(todas_gestiones) > len(gestiones_actuales_norm):
            self.log(f"    ✅ V2: Gestiones combinadas - Antes: {', '.join(gestiones_actuales_norm)} | Después: {', '.join(todas_gestiones)}")
        
        return todas_gestiones
    
    def procesar_ivr(self, cliente_row, carpeta_cliente, nombre_cliente):
        self.log(f"  🎯 IVR: Iniciando procesamiento para {nombre_cliente}")
        
        # El archivo MP3 es OBLIGATORIO si hay gestión IVR
        if not self.ivr_base_audio:
            self.log(f"  ⚠️ IVR: Audio base NO seleccionado para {nombre_cliente} - NO SE CREARÁ MP3 OBLIGATORIO")
            # Continuar intentando crear el Excel aunque no haya audio
        else:
            # Copiar audio OBLIGATORIO (siempre se crea si hay gestión IVR)
            try:
                nombre_audio = f"ivr_{self.sanitize_filename(nombre_cliente)}.mp3"
                archivo_audio = os.path.join(carpeta_cliente, nombre_audio)
                
                if os.path.exists(self.ivr_base_audio):
                    shutil.copy2(self.ivr_base_audio, archivo_audio)
                    self.log(f"  ✅ IVR audio MP3 creado (OBLIGATORIO): {nombre_cliente} → {nombre_audio}")
                else:
                    self.log(f"  ⚠️ IVR: Audio base no existe en ruta '{self.ivr_base_audio}' - NO SE CREARÁ MP3")
            except Exception as e:
                self.log(f"  ⚠️ Error copiando audio IVR para {nombre_cliente}: {str(e)}")
        
        # Procesar Excel (opcional, solo si hay archivo base)
        if not self.ivr_base_excel:
            self.log(f"  ⚠️ IVR: Archivo base Excel no seleccionado para {nombre_cliente} - Solo se creó el MP3")
            return
        
        try:
            # Leer archivo base IVR
            df_ivr = pd.read_excel(self.ivr_base_excel)
            
            # Buscar cliente por match
            match_cliente_col = self.ivr_match_cliente_combo.get()
            match_archivo_col = self.ivr_match_archivo_combo.get()
            
            cuenta_cliente = str(cliente_row.get(match_cliente_col, "")).strip()
            
            # Verificar que la columna existe
            if match_archivo_col not in df_ivr.columns:
                self.log(f"  ⚠️ Error de match IVR Excel para {nombre_cliente}: Columna '{match_archivo_col}' no encontrada en archivo base")
                return
            
            # Filtrar cliente
            cliente_data = df_ivr[df_ivr[match_archivo_col].astype(str).str.strip() == cuenta_cliente]
            
            # Filtrar por GESTION EFECTIVA = IVR
            gestion_col = None
            for col in cliente_data.columns:
                if "GESTION EFECTIVA" in str(col).upper():
                    gestion_col = col
                    break
            
            if gestion_col:
                cliente_data = cliente_data[cliente_data[gestion_col].astype(str).str.contains("IVR", case=False, na=False)]
            
            if len(cliente_data) > 0:
                try:
                    # Agregar campo TIPO DE GESTION
                    cliente_data = cliente_data.copy()
                    cliente_data["TIPO DE GESTION"] = "IVR"
                    
                    # Guardar Excel
                    nombre_archivo = f"{self.sanitize_filename(nombre_cliente)}_ivr.xlsx"
                    archivo_excel = os.path.join(carpeta_cliente, nombre_archivo)
                    cliente_data.to_excel(archivo_excel, index=False)
                    
                    self.log(f"  ✅ IVR Excel creado: {nombre_cliente}")
                except Exception as e:
                    self.log(f"  ⚠️ Error creando Excel IVR para {nombre_cliente}: {str(e)}")
            else:
                self.log(f"  ⚠️ Error de match IVR Excel para {nombre_cliente}: No se encontró en archivo base con {match_cliente_col}={cuenta_cliente}")
        
        except Exception as e:
            self.log(f"  ❌ Error procesando Excel IVR para {nombre_cliente}: {str(e)}")
    
    def procesar_sms(self, cliente_row, carpeta_cliente, nombre_cliente):
        if not self.sms_base_excel:
            self.log(f"  ⚠️ SMS: Archivo base no seleccionado para {nombre_cliente}")
            return
        
        try:
            # Leer archivo base SMS
            df_sms = pd.read_excel(self.sms_base_excel)
            
            # Buscar cliente por match
            match_cliente_col = self.sms_match_cliente_combo.get()
            match_archivo_col = self.sms_match_archivo_combo.get()
            
            valor_cliente = str(cliente_row.get(match_cliente_col, "")).strip()
            
            # Verificar que la columna existe
            if match_archivo_col not in df_sms.columns:
                self.log(f"  ⚠️ Error de match SMS para {nombre_cliente}: Columna '{match_archivo_col}' no encontrada en archivo base")
                return
            
            # Filtrar cliente
            cliente_data = df_sms[df_sms[match_archivo_col].astype(str).str.strip() == valor_cliente]
            
            if len(cliente_data) > 0:
                # Guardar Excel
                nombre_archivo = f"SMS_{self.sanitize_filename(nombre_cliente)}.xlsx"
                archivo_excel = os.path.join(carpeta_cliente, nombre_archivo)
                cliente_data.to_excel(archivo_excel, index=False)
                
                self.log(f"  ✅ SMS procesado: {nombre_cliente}")
            else:
                self.log(f"  ⚠️ Error de match SMS para {nombre_cliente}: No se encontró en archivo base con {match_cliente_col}={valor_cliente}")
        
        except Exception as e:
            self.log(f"  ❌ Error procesando SMS para {nombre_cliente}: {str(e)}")
    
    def procesar_call(self, cliente_row, carpeta_cliente, nombre_cliente, cuenta_cliente):
        self.log(f"  🎯 CALL: Iniciando procesamiento para {nombre_cliente}")
        
        # Verificar primero si tenemos el archivo consolidado (esto es LO MÁS IMPORTANTE)
        if not self.call_consolidado_excel:
            self.log(f"  ⚠️ CALL: Archivo consolidado NO seleccionado para {nombre_cliente} - NO SE PROCESARÁ AUDIO")
            return
        
        # Obtener datos del cliente
        cuenta_valor = str(cliente_row.get("CUENTA", "")).strip()
        telefono_cliente = str(cliente_row.get("TELEFONO", "")).strip()
        
        self.log(f"  📞 CALL: Cliente {nombre_cliente} - CUENTA: {cuenta_valor}, TELEFONO: {telefono_cliente}")
        
        # Intentar crear Excel de gestiones (pero si falla, continuar de todos modos)
        archivo_gestiones = None
        if self.ivr_use_for_call.get() and self.ivr_base_excel:
            archivo_gestiones = self.ivr_base_excel
        elif self.call_gestiones_excel:
            archivo_gestiones = self.call_gestiones_excel
        
        if archivo_gestiones:
            try:
                # Leer archivo de gestiones
                df_gestiones = pd.read_excel(archivo_gestiones)
                
                # Buscar cliente por CUENTA
                cuenta_col_name = None
                for col in df_gestiones.columns:
                    if "CUENTA" in str(col).upper():
                        cuenta_col_name = col
                        break
                
                if cuenta_col_name:
                    # Filtrar cliente
                    cliente_data = df_gestiones[df_gestiones[cuenta_col_name].astype(str).str.strip() == cuenta_valor]
                    
                    # Filtrar por GESTION EFECTIVA = CALL
                    gestion_col = None
                    for col in cliente_data.columns:
                        if "GESTION EFECTIVA" in str(col).upper():
                            gestion_col = col
                            break
                    
                    if gestion_col:
                        cliente_data = cliente_data[cliente_data[gestion_col].astype(str).str.contains("CALL", case=False, na=False)]
                    
                    if len(cliente_data) > 0:
                        try:
                            # Agregar campo TIPO DE GESTION
                            cliente_data = cliente_data.copy()
                            cliente_data["TIPO DE GESTION"] = "CALL"
                            
                            # Guardar Excel de gestiones
                            nombre_archivo = f"{self.sanitize_filename(nombre_cliente)}_gestiones.xlsx"
                            archivo_excel = os.path.join(carpeta_cliente, nombre_archivo)
                            cliente_data.to_excel(archivo_excel, index=False)
                            self.log(f"  ✅ CALL gestiones Excel creado: {nombre_cliente}")
                        except Exception as e:
                            self.log(f"  ⚠️ Error creando Excel de gestiones CALL para {nombre_cliente}: {str(e)} - Continuando con audio...")
            except Exception as e:
                self.log(f"  ⚠️ Error procesando gestiones CALL para {nombre_cliente}: {str(e)} - Continuando con audio...")
        
        # PROCESAR AUDIO (ESTO ES LO MÁS IMPORTANTE - SIEMPRE SE EJECUTA SI HAY ARCHIVO CONSOLIDADO)
        if not telefono_cliente:
            self.log(f"  ⚠️ CALL: Cliente {nombre_cliente} NO tiene teléfono - No se puede buscar audio")
            return
        
        try:
            self.log(f"  🔍 CALL: Buscando audio para {nombre_cliente} (teléfono: {telefono_cliente})")
            
            # Leer archivo consolidado
            df_call = pd.read_excel(self.call_consolidado_excel)
            self.log(f"  📊 CALL: Archivo consolidado cargado - {len(df_call)} registros")
            self.log(f"  📋 CALL: Columnas disponibles: {', '.join(df_call.columns.tolist())}")
            
            # Buscar columna numero_celular (case-insensitive, con o sin guión bajo/espacio)
            numero_col = None
            ruta_col = None
            
            # Primero buscar exacto (numero_celular o numero celular) - SIN ESPACIOS NI GUIONES
            for col in df_call.columns:
                col_clean = str(col).strip().upper().replace("_", "").replace("-", "").replace(" ", "")
                if col_clean == "NUMEROCELULAR":
                    numero_col = col
                    break
            
            # Si no se encuentra, buscar que contenga "NUMERO" y "CELULAR"
            if not numero_col:
                for col in df_call.columns:
                    col_upper = str(col).upper()
                    if "NUMERO" in col_upper and "CELULAR" in col_upper:
                        numero_col = col
                        break
            
            # Buscar columna ruta (PRIMERO BUSCAR EXACTO EN MINÚSCULAS)
            for col in df_call.columns:
                if str(col).strip().lower() == "ruta":  # BUSCAR EXACTO EN MINÚSCULAS PRIMERO
                    ruta_col = col
                    break
            
            # Si no se encuentra en minúsculas, buscar case-insensitive
            if not ruta_col:
                for col in df_call.columns:
                    col_upper = str(col).strip().upper()
                    if col_upper == "RUTA":
                        ruta_col = col
                        break
            
            self.log(f"  🔍 CALL: Columnas encontradas - numero_celular: '{numero_col}', ruta: '{ruta_col}'")
            
            if not numero_col:
                self.log(f"  ❌ CALL: NO se encontró columna numero_celular en archivo consolidado")
                cols_disponibles = ", ".join(df_call.columns)
                self.log(f"     Columnas disponibles: {cols_disponibles}")
                return
            
            if not ruta_col:
                self.log(f"  ❌ CALL: NO se encontró columna 'ruta' en archivo consolidado")
                cols_disponibles = ", ".join(df_call.columns)
                self.log(f"     Columnas disponibles: {cols_disponibles}")
                return
            
            # Hacer match con numero_celular (normalizar ambos lados)
            df_call[numero_col] = df_call[numero_col].astype(str).str.strip()
            audio_match = df_call[df_call[numero_col] == telefono_cliente]
            
            self.log(f"  🔍 CALL: Búsqueda realizada con teléfono '{telefono_cliente}' - Encontradas {len(audio_match)} coincidencias")
            
            if len(audio_match) == 0:
                # Mostrar valores de ejemplo para debug
                valores_ejemplo = df_call[numero_col].head(10).tolist()
                self.log(f"  ⚠️ CALL: NO se encontró match para teléfono '{telefono_cliente}' en reporte consolidado (cliente: {nombre_cliente})")
                self.log(f"     Columna usada para match: '{numero_col}'")
                self.log(f"     Valores ejemplo en columna '{numero_col}': {valores_ejemplo}")
                self.log(f"     Teléfono buscado: '{telefono_cliente}' (tipo: {type(telefono_cliente)})")
                return
            
            # Tomar la primera coincidencia
            ruta_audio = str(audio_match.iloc[0][ruta_col]).strip()
            
            # Limpiar la ruta (puede tener espacios o caracteres especiales)
            ruta_audio = ruta_audio.replace('"', '').replace("'", "").strip()
            
            self.log(f"  📁 CALL: RUTA ENCONTRADA para {nombre_cliente}: '{ruta_audio}'")
            
            if not ruta_audio or ruta_audio.upper() in ["NAN", "NONE", ""]:
                self.log(f"  ⚠️ CALL: Ruta de audio vacía o inválida para {nombre_cliente}")
                self.log(f"     Valor en campo 'ruta': '{ruta_audio}'")
                return
            
            # Verificar si el archivo existe en la ruta especificada
            archivo_existe = os.path.exists(ruta_audio)
            self.log(f"  📂 CALL: Verificando existencia - Ruta: '{ruta_audio}' | Existe: {archivo_existe}")
            
            if not archivo_existe:
                # Mostrar información de debug
                dir_padre = os.path.dirname(ruta_audio)
                self.log(f"  ⚠️ CALL: Audio NO encontrado en ruta para {nombre_cliente}")
                self.log(f"     Ruta buscada: '{ruta_audio}'")
                self.log(f"     Directorio padre: '{dir_padre}'")
                self.log(f"     Directorio padre existe: {os.path.exists(dir_padre) if dir_padre else 'N/A'}")
                return
            
            # Copiar el archivo a la carpeta del cliente
            nombre_audio = f"{self.sanitize_filename(nombre_cliente)}_{cuenta_valor}.mp3"
            archivo_audio_destino = os.path.join(carpeta_cliente, nombre_audio)
            
            self.log(f"  📋 CALL: Copiando archivo - Origen: '{ruta_audio}' | Destino: '{archivo_audio_destino}'")
            
            try:
                shutil.copy2(ruta_audio, archivo_audio_destino)
                self.log(f"  ✅ CALL audio copiado exitosamente: {nombre_cliente} → {nombre_audio}")
            except Exception as e:
                self.log(f"  ⚠️ Error copiando audio CALL para {nombre_cliente}: {str(e)}")
                import traceback
                self.log(f"     Traceback: {traceback.format_exc()}")
                
        except Exception as e:
            self.log(f"  ❌ Error procesando audio CALL para {nombre_cliente}: {str(e)}")
            import traceback
            self.log(f"     Traceback: {traceback.format_exc()}")
    
    def buscar_audio_fisico(self, ruta_relativa):
        """Busca el audio físico en la carpeta de audios"""
        if not self.call_audios_fisicos_path:
            return None
        
        # Normalizar ruta
        nombre_archivo = os.path.basename(ruta_relativa)
        
        # Buscar recursivamente
        for root, dirs, files in os.walk(self.call_audios_fisicos_path):
            if nombre_archivo in files:
                return os.path.join(root, nombre_archivo)
        
        return None
    
    def sanitize_filename(self, filename):
        """Limpia el nombre de archivo de caracteres inválidos"""
        filename = re.sub(r'[<>:"/\\|?*]', '', filename)
        return filename.strip()
    
    def simular_resultado(self):
        if self.datos_fuente_df is None:
            messagebox.showwarning("Advertencia", "Debe cargar datos_fuente.xlsx primero")
            return
        
        # Ventana de simulación
        sim_window = tk.Toplevel(self.root)
        sim_window.title("Simulación de Resultado")
        sim_window.geometry("900x700")
        sim_window.configure(bg="#ecf0f1")
        
        # Opciones de formato
        formato_frame = tk.Frame(sim_window, bg="#34495e", pady=10)
        formato_frame.pack(fill=tk.X)
        
        tk.Label(
            formato_frame,
            text="Formato de salida:",
            font=("Arial", 10, "bold"),
            bg="#34495e",
            fg="white"
        ).pack(side=tk.LEFT, padx=10)
        
        formato_var = tk.StringVar(value="HTML")
        tk.Radiobutton(formato_frame, text="HTML", variable=formato_var, value="HTML", bg="#34495e", fg="white", selectcolor="#2c3e50").pack(side=tk.LEFT, padx=5)
        tk.Radiobutton(formato_frame, text="JSON", variable=formato_var, value="JSON", bg="#34495e", fg="white", selectcolor="#2c3e50").pack(side=tk.LEFT, padx=5)
        tk.Radiobutton(formato_frame, text="TXT", variable=formato_var, value="TXT", bg="#34495e", fg="white", selectcolor="#2c3e50").pack(side=tk.LEFT, padx=5)
        
        # Texto de resultado
        text_frame = tk.Frame(sim_window, bg="#ecf0f1")
        text_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        resultado_text = scrolledtext.ScrolledText(
            text_frame,
            font=("Consolas", 9),
            bg="#2c3e50",
            fg="#ecf0f1",
            wrap=tk.WORD
        )
        resultado_text.pack(fill=tk.BOTH, expand=True)
        
        def generar_simulacion():
            resultado_text.delete(1.0, tk.END)
            
            formato = formato_var.get()
            simulacion = self.generar_simulacion_datos(formato)
            
            resultado_text.insert(1.0, simulacion)
        
        def exportar_simulacion():
            formato = formato_var.get()
            simulacion = self.generar_simulacion_datos(formato)
            
            file_path = filedialog.asksaveasfilename(
                defaultextension=f".{formato.lower()}",
                filetypes=[(f"{formato} files", f"*.{formato.lower()}")]
            )
            
            if file_path:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(simulacion)
                messagebox.showinfo("Éxito", f"Simulación exportada a {file_path}")
        
        tk.Button(
            formato_frame,
            text="Generar",
            command=generar_simulacion,
            bg="#27ae60",
            fg="white",
            font=("Arial", 9, "bold"),
            cursor="hand2"
        ).pack(side=tk.LEFT, padx=10)
        
        tk.Button(
            formato_frame,
            text="Exportar",
            command=exportar_simulacion,
            bg="#e67e22",
            fg="white",
            font=("Arial", 9, "bold"),
            cursor="hand2"
        ).pack(side=tk.LEFT, padx=5)
        
        # Generar automáticamente
        generar_simulacion()
    
    def generar_simulacion_datos(self, formato):
        if self.datos_fuente_df is None:
            return "Error: No hay datos cargados"
        
        nombre_carpeta = datetime.now().strftime("evidencias_%d-%m-%y")
        carpeta_salida = self.carpeta_salida_path or "/evidencias"
        
        resultados = []
        
        for idx, cliente_row in self.datos_fuente_df.iterrows():
            nombre_cliente = str(cliente_row.get("NOMBRE", cliente_row.get("CLIENTE", "Sin nombre"))).strip()
            cuenta_cliente = str(cliente_row.get("CUENTA", "")).strip()
            gestion_efectiva = str(cliente_row.get("GESTION EFECTIVA", "")).strip()
            
            # Normalizar gestiones (siempre a mayúsculas)
            gestiones = [g.strip().upper().replace("GRABACION CALL", "CALL").replace("GRABACIÓN CALL", "CALL") 
                         for g in gestion_efectiva.split(",") if g.strip()]
            
            # Si V2 está activo, combinar con nuevos_datos
            if self.v2_enabled.get() and self.nuevos_datos_df is not None:
                gestiones = self.obtener_gestiones_v2(cuenta_cliente, gestiones)
            
            # Generar lista de archivos que se crearán
            archivos = self.generar_lista_archivos(nombre_cliente, cuenta_cliente, gestiones)
            
            resultados.append({
                "id": idx + 1,
                "cliente": nombre_cliente,
                "cuenta": cuenta_cliente,
                "gestiones": gestiones,
                "archivos": archivos
            })
        
        if formato == "HTML":
            return self.generar_html_simulacion(resultados, carpeta_salida, nombre_carpeta)
        elif formato == "JSON":
            return json.dumps(resultados, indent=2, ensure_ascii=False)
        else:  # TXT
            return self.generar_txt_simulacion(resultados, carpeta_salida, nombre_carpeta)
    
    def generar_lista_archivos(self, nombre_cliente, cuenta_cliente, gestiones):
        """Genera la lista de archivos que se crearán para un cliente según sus gestiones"""
        archivos = []
        nombre_sanitizado = self.sanitize_filename(nombre_cliente)
        
        for gestion in gestiones:
            if gestion == "IVR":
                archivos.append(f"{nombre_sanitizado}_ivr.xlsx")
                archivos.append(f"ivr_{nombre_sanitizado}.mp3")
            elif gestion == "SMS":
                archivos.append(f"SMS_{nombre_sanitizado}.xlsx")
            elif gestion == "CALL":
                archivos.append(f"{nombre_sanitizado}_gestiones.xlsx")
                archivos.append(f"{nombre_sanitizado}_{cuenta_cliente}.mp3")
        
        return archivos
    
    def generar_html_simulacion(self, resultados, carpeta_salida, nombre_carpeta):
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Simulación de Evidencias</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }}
                h1 {{ color: #2c3e50; }}
                table {{ border-collapse: collapse; width: 100%; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
                th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
                th {{ background: #34495e; color: white; }}
                tr:nth-child(even) {{ background: #f9f9f9; }}
                .generar-btn {{ background: #27ae60; color: white; padding: 5px 10px; border: none; cursor: pointer; border-radius: 3px; }}
                .generar-btn:hover {{ background: #229954; }}
                .archivos {{ font-size: 0.9em; color: #7f8c8d; margin-top: 5px; }}
                .archivo-item {{ margin: 2px 0; padding-left: 10px; }}
            </style>
        </head>
        <body>
            <h1>📋 Simulación de Evidencias</h1>
            <p><strong>Ruta:</strong> {carpeta_salida}</p>
            <p><strong>Carpeta:</strong> {nombre_carpeta}</p>
            <table>
                <tr>
                    <th>ID</th>
                    <th>Cliente</th>
                    <th>Gestiones</th>
                    <th>Archivos a crear</th>
                    <th>Acción</th>
                </tr>
        """
        
        for item in resultados[:100]:  # Limitar a 100 para no sobrecargar
            gestiones_str = ", ".join(item["gestiones"])
            archivos_html = "<div class='archivos'>"
            for archivo in item.get("archivos", []):
                archivos_html += f"<div class='archivo-item'>📄 {archivo}</div>"
            archivos_html += "</div>"
            
            html += f"""
                <tr>
                    <td>{item['id']}</td>
                    <td>{item['cliente']}</td>
                    <td>{gestiones_str}</td>
                    <td>{archivos_html}</td>
                    <td><button class="generar-btn" onclick="alert('Generar archivos para {item['cliente']}')">Generar Archivos</button></td>
                </tr>
            """
        
        html += """
            </table>
        </body>
        </html>
        """
        
        return html
    
    def generar_txt_simulacion(self, resultados, carpeta_salida, nombre_carpeta):
        txt = f"GESTIONES - Simulación de Resultado\n"
        txt += "=" * 120 + "\n\n"
        txt += f"Ruta: {carpeta_salida}\n"
        txt += f"Carpeta: {nombre_carpeta}\n\n"
        txt += f"{'ID':<5} | {'CLIENTE':<40} | {'GESTIONES':<30} | {'ARCHIVOS':<50}\n"
        txt += "-" * 120 + "\n"
        
        for item in resultados:
            gestiones_str = ", ".join(item["gestiones"])
            archivos_str = ", ".join(item.get("archivos", []))
            txt += f"{item['id']:<5} | {item['cliente'][:40]:<40} | {gestiones_str:<30} | {archivos_str[:50]:<50}\n"
            # Si hay muchos archivos, mostrar en líneas adicionales
            if len(item.get("archivos", [])) > 2:
                for archivo in item.get("archivos", []):
                    txt += f"{'':<5} | {'':<40} | {'':<30} |   📄 {archivo}\n"
        
        return txt
    
    def ejecutar_auditor(self):
        if not self.carpeta_salida_path:
            messagebox.showerror("Error", "Debe seleccionar carpeta de salida primero")
            return
        
        # Verificar si ya hay una ventana de auditoría abierta
        if hasattr(self, 'auditor_window_open') and self.auditor_window_open:
            messagebox.showinfo("Información", "La auditoría ya está en ejecución")
            return
        
        self.auditor_window_open = True
        
        try:
            self.log("🔍 Iniciando auditoría...")
            
            # Buscar carpeta de evidencias más reciente
            carpetas = [d for d in os.listdir(self.carpeta_salida_path) 
                        if os.path.isdir(os.path.join(self.carpeta_salida_path, d)) and "evidencias" in d]
            
            if not carpetas:
                messagebox.showwarning("Advertencia", "No se encontraron carpetas de evidencias")
                return
            
            carpeta_auditoria = os.path.join(self.carpeta_salida_path, carpetas[-1])
            
            reporte = self.auditar_carpetas(carpeta_auditoria)
            
            # Mostrar reporte y registrar que la ventana se cerró
            def on_window_close():
                self.auditor_window_open = False
            
            # Mostrar reporte
            self.mostrar_reporte_auditoria(reporte, on_window_close)
        except Exception as e:
            self.log(f"❌ Error en auditoría: {str(e)}")
            self.auditor_window_open = False
    
    def auditar_carpetas(self, carpeta_base):
        """Audita las carpetas y verifica que tengan los archivos correctos según sus gestiones"""
        reporte = {
            "total_carpetas": 0,
            "carpetas_ok": 0,
            "carpetas_error": [],
            "archivos_faltantes": []
        }
        
        # Obtener datos fuente para saber qué gestiones esperar
        if self.datos_fuente_df is None:
            messagebox.showwarning("Advertencia", "Debe cargar datos_fuente.xlsx para hacer auditoría completa")
        
        for carpeta_cliente in os.listdir(carpeta_base):
            carpeta_path = os.path.join(carpeta_base, carpeta_cliente)
            if os.path.isdir(carpeta_path):
                reporte["total_carpetas"] += 1
                
                archivos = os.listdir(carpeta_path)
                
                # Extraer nombre y cuenta del nombre de carpeta
                # Formato: "NOMBRE_CUENTA"
                partes_carpeta = carpeta_cliente.rsplit("_", 1)
                if len(partes_carpeta) >= 2:
                    cuenta_carpeta = partes_carpeta[-1]
                    
                    # Buscar cliente en datos_fuente para obtener gestiones esperadas
                    gestiones_esperadas = []
                    if self.datos_fuente_df is not None:
                        cuenta_col = None
                        gestion_col = None
                        nombre_col = None
                        
                        for col in self.datos_fuente_df.columns:
                            if "CUENTA" in str(col).upper():
                                cuenta_col = col
                            if "GESTION EFECTIVA" in str(col).upper():
                                gestion_col = col
                            if "NOMBRE" in str(col).upper() or "CLIENTE" in str(col).upper():
                                nombre_col = col
                        
                        if cuenta_col and gestion_col:
                            matches = self.datos_fuente_df[
                                self.datos_fuente_df[cuenta_col].astype(str).str.strip() == cuenta_carpeta
                            ]
                            
                            if len(matches) > 0:
                                gestion_efectiva = str(matches.iloc[0][gestion_col]).strip()
                                gestiones_esperadas = [g.strip().upper().replace("GRABACION CALL", "CALL") 
                                                      for g in gestion_efectiva.split(",") if g.strip()]
                                
                                # Si V2 está activo, combinar con nuevos_datos
                                if self.v2_enabled.get() and self.nuevos_datos_df is not None:
                                    gestiones_esperadas = self.obtener_gestiones_v2(cuenta_carpeta, gestiones_esperadas)
                
                # Verificar archivos según gestiones esperadas
                archivos_esperados = []
                archivos_encontrados = set(f.lower() for f in archivos)
                
                for gestion in gestiones_esperadas:
                    if gestion == "IVR":
                        archivos_esperados.append("ivr.xlsx")
                        archivos_esperados.append("ivr.mp3")
                    elif gestion == "SMS":
                        archivos_esperados.append("sms.xlsx")
                    elif gestion == "CALL":
                        archivos_esperados.append("gestiones.xlsx")
                        archivos_esperados.append(".mp3")  # Audio call (cualquier mp3 que no sea IVR)
                
                # Verificar archivos presentes
                tiene_ivr_excel = any("ivr" in f.lower() and f.endswith(".xlsx") for f in archivos)
                tiene_ivr_audio = any("ivr" in f.lower() and f.endswith(".mp3") for f in archivos)
                tiene_sms = any("sms" in f.lower() and f.endswith(".xlsx") for f in archivos)
                tiene_call_excel = any("gestiones" in f.lower() and f.endswith(".xlsx") for f in archivos)
                tiene_call_audio = any(f.endswith(".mp3") and "ivr" not in f.lower() for f in archivos)
                
                errores = []
                archivos_faltantes = []
                
                # Verificar según gestiones esperadas
                if "IVR" in gestiones_esperadas:
                    if not tiene_ivr_excel:
                        errores.append("Falta Excel IVR")
                        archivos_faltantes.append("Archivo Excel IVR")
                    if not tiene_ivr_audio:
                        errores.append("Falta audio IVR")
                        archivos_faltantes.append("Audio MP3 IVR")
                
                if "SMS" in gestiones_esperadas:
                    if not tiene_sms:
                        errores.append("Falta Excel SMS")
                        archivos_faltantes.append("Archivo Excel SMS")
                
                if "CALL" in gestiones_esperadas:
                    if not tiene_call_excel:
                        errores.append("Falta Excel CALL")
                        archivos_faltantes.append("Archivo Excel gestiones")
                    if not tiene_call_audio:
                        errores.append("Falta audio CALL")
                        archivos_faltantes.append("Audio MP3 CALL")
                
                # Verificar cantidad total de archivos
                num_archivos_esperados = len(archivos_esperados)
                if num_archivos_esperados > 0 and len(archivos) != num_archivos_esperados:
                    if len(archivos) < num_archivos_esperados:
                        errores.append(f"Faltan archivos: esperados {num_archivos_esperados}, encontrados {len(archivos)}")
                
                if len(archivos) == 0:
                    errores.append("Carpeta vacía")
                
                if errores:
                    reporte["carpetas_error"].append({
                        "carpeta": carpeta_cliente,
                        "errores": errores,
                        "gestiones_esperadas": gestiones_esperadas,
                        "archivos_faltantes": archivos_faltantes,
                        "archivos_encontrados": len(archivos),
                        "archivos_esperados": num_archivos_esperados
                    })
                else:
                    reporte["carpetas_ok"] += 1
        
        return reporte
    
    def mostrar_reporte_auditoria(self, reporte, on_close_callback=None):
        window = tk.Toplevel(self.root)
        window.title("Reporte de Auditoría")
        window.geometry("900x700")
        window.configure(bg="#f5f5f5")
        
        # Registrar callback cuando se cierre la ventana
        def on_closing():
            if on_close_callback:
                on_close_callback()
            window.destroy()
        
        window.protocol("WM_DELETE_WINDOW", on_closing)
        
        # Canvas con scrollbar
        main_canvas = tk.Canvas(window, bg="#f5f5f5", highlightthickness=0)
        scrollbar_y = ttk.Scrollbar(window, orient="vertical", command=main_canvas.yview)
        scrollable_frame = tk.Frame(main_canvas, bg="#f5f5f5")
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: main_canvas.configure(scrollregion=main_canvas.bbox("all"))
        )
        
        main_canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        main_canvas.configure(yscrollcommand=scrollbar_y.set)
        
        main_canvas.pack(side="left", fill="both", expand=True, padx=10, pady=10)
        scrollbar_y.pack(side="right", fill="y")
        
        # Header profesional
        header_frame = tk.Frame(scrollable_frame, bg="#2c3e50", pady=20, padx=20)
        header_frame.pack(fill=tk.X, pady=(0, 15))
        
        tk.Label(
            header_frame,
            text="📊 REPORTE DE AUDITORÍA",
            font=("Arial", 20, "bold"),
            bg="#2c3e50",
            fg="white"
        ).pack()
        
        # Resumen con cards profesionales
        resumen_frame = tk.Frame(scrollable_frame, bg="#ecf0f1", pady=15, padx=15, relief=tk.RAISED, bd=2)
        resumen_frame.pack(fill=tk.X, pady=10)
        
        stats_frame = tk.Frame(resumen_frame, bg="#ecf0f1")
        stats_frame.pack(fill=tk.X)
        
        # Card 1: Total
        card_total = tk.Frame(stats_frame, bg="#3498db", pady=15, padx=20, relief=tk.RAISED, bd=2)
        card_total.pack(side=tk.LEFT, padx=10, expand=True)
        tk.Label(card_total, text="📁 Total", font=("Arial", 10), bg="#3498db", fg="white").pack()
        tk.Label(card_total, text=str(reporte['total_carpetas']), font=("Arial", 24, "bold"), bg="#3498db", fg="white").pack()
        
        # Card 2: OK
        card_ok = tk.Frame(stats_frame, bg="#27ae60", pady=15, padx=20, relief=tk.RAISED, bd=2)
        card_ok.pack(side=tk.LEFT, padx=10, expand=True)
        tk.Label(card_ok, text="✅ Correctas", font=("Arial", 10), bg="#27ae60", fg="white").pack()
        tk.Label(card_ok, text=str(reporte['carpetas_ok']), font=("Arial", 24, "bold"), bg="#27ae60", fg="white").pack()
        
        # Card 3: Errores
        card_errores = tk.Frame(stats_frame, bg="#e74c3c", pady=15, padx=20, relief=tk.RAISED, bd=2)
        card_errores.pack(side=tk.LEFT, padx=10, expand=True)
        tk.Label(card_errores, text="❌ Con Errores", font=("Arial", 10), bg="#e74c3c", fg="white").pack()
        tk.Label(card_errores, text=str(len(reporte['carpetas_error'])), font=("Arial", 24, "bold"), bg="#e74c3c", fg="white").pack()
        
        # Botón crear archivos faltantes
        if reporte['carpetas_error']:
            botones_frame = tk.Frame(scrollable_frame, bg="#f5f5f5", pady=10)
            botones_frame.pack(fill=tk.X, padx=10)
            
            tk.Button(
                botones_frame,
                text="🔧 Crear Archivos Faltantes",
                command=lambda: self.crear_archivos_faltantes(reporte, window),
                bg="#8e44ad",
                fg="white",
                font=("Arial", 12, "bold"),
                pady=10,
                cursor="hand2"
            ).pack(side=tk.LEFT, padx=5)
            
            tk.Button(
                botones_frame,
                text="📄 Exportar HTML",
                command=lambda: self.exportar_reporte_html(reporte),
                bg="#e67e22",
                fg="white",
                font=("Arial", 11, "bold"),
                pady=8,
                cursor="hand2"
            ).pack(side=tk.LEFT, padx=5)
        
        # Área de errores con acordeones
        if reporte['carpetas_error']:
            errores_container = tk.Frame(scrollable_frame, bg="#f5f5f5")
            errores_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
            
            tk.Label(
                errores_container,
                text="📋 DETALLE DE ERRORES",
                font=("Arial", 14, "bold"),
                bg="#f5f5f5",
                fg="#2c3e50"
            ).pack(anchor=tk.W, pady=(0, 10))
            
            # Crear acordeones para cada error
            self.acordeones_auditoria = []
            for idx, error_item in enumerate(reporte['carpetas_error']):
                acordeon = self.crear_acordeon_auditoria(errores_container, error_item, idx)
                self.acordeones_auditoria.append(acordeon)
        else:
            success_frame = tk.Frame(scrollable_frame, bg="#d4edda", pady=30, padx=30, relief=tk.RAISED, bd=2)
            success_frame.pack(fill=tk.X, pady=20, padx=10)
            
            tk.Label(
                success_frame,
                text="✅ Todas las carpetas están correctas",
                font=("Arial", 16, "bold"),
                bg="#d4edda",
                fg="#155724"
            ).pack()
        
        # Configurar scroll con mouse wheel
        main_canvas.bind_all("<MouseWheel>", lambda e: main_canvas.yview_scroll(int(-1*(e.delta/120)), "units"))
    
    def crear_acordeon_auditoria(self, parent, error_item, idx):
        """Crea un acordeón para cada error de auditoría"""
        acordeon_frame = tk.Frame(parent, bg="#ecf0f1", relief=tk.RAISED, bd=1)
        acordeon_frame.pack(fill=tk.X, pady=5)
        
        # Header del acordeón
        header = tk.Frame(acordeon_frame, bg="#34495e", pady=10, padx=15)
        header.pack(fill=tk.X)
        
        toggle_var = tk.BooleanVar(value=False)
        
        def toggle():
            if toggle_var.get():
                content_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
                toggle_btn.config(text="▼")
            else:
                content_frame.pack_forget()
                toggle_btn.config(text="▶")
        
        header_info = tk.Frame(header, bg="#34495e")
        header_info.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        tk.Label(
            header_info,
            text=f"📁 {error_item['carpeta']}",
            font=("Arial", 11, "bold"),
            bg="#34495e",
            fg="white"
        ).pack(anchor=tk.W)
        
        gestiones_str = ", ".join(error_item.get('gestiones_esperadas', []))
        tk.Label(
            header_info,
            text=f"Gestiones: {gestiones_str} | Archivos: {error_item.get('archivos_encontrados', 0)}/{error_item.get('archivos_esperados', 0)}",
            font=("Arial", 9),
            bg="#34495e",
            fg="#ecf0f1"
        ).pack(anchor=tk.W)
        
        toggle_btn = tk.Button(
            header,
            text="▶",
            command=lambda: [toggle_var.set(not toggle_var.get()), toggle()],
            bg="#27ae60",
            fg="white",
            font=("Arial", 12),
            width=3,
            cursor="hand2"
        )
        toggle_btn.pack(side=tk.RIGHT, padx=10)
        
        # Contenido del acordeón
        content_frame = tk.Frame(acordeon_frame, bg="#ffffff", padx=15, pady=10)
        
        # Detalles
        detalles_text = scrolledtext.ScrolledText(content_frame, height=8, width=80, wrap=tk.WORD, font=("Arial", 9))
        detalles_text.pack(fill=tk.BOTH, expand=True, pady=5)
        
        detalles_text.insert(tk.END, f"📋 CARPETA: {error_item['carpeta']}\n")
        detalles_text.insert(tk.END, f"{'='*60}\n\n")
        
        gestiones_str = ", ".join(error_item.get('gestiones_esperadas', []))
        detalles_text.insert(tk.END, f"🔍 Gestiones esperadas: {gestiones_str}\n")
        detalles_text.insert(tk.END, f"📊 Archivos encontrados: {error_item.get('archivos_encontrados', 0)}\n")
        detalles_text.insert(tk.END, f"📊 Archivos esperados: {error_item.get('archivos_esperados', 0)}\n\n")
        
        detalles_text.insert(tk.END, "❌ ERRORES ENCONTRADOS:\n")
        detalles_text.insert(tk.END, f"{'-'*60}\n")
        for error in error_item['errores']:
            detalles_text.insert(tk.END, f"  • {error}\n")
        
        if error_item.get('archivos_faltantes'):
            detalles_text.insert(tk.END, f"\n📄 ARCHIVOS FALTANTES:\n")
            detalles_text.insert(tk.END, f"{'-'*60}\n")
            for archivo in error_item['archivos_faltantes']:
                detalles_text.insert(tk.END, f"  • {archivo}\n")
        
        detalles_text.config(state=tk.DISABLED)
        
        # Botón para crear archivos de este cliente
        if error_item.get('archivos_faltantes'):
            btn_crear = tk.Button(
                content_frame,
                text=f"🔧 Crear Archivos para {error_item['carpeta']}",
                command=lambda: self.crear_archivos_cliente(error_item),
                bg="#27ae60",
                fg="white",
                font=("Arial", 10, "bold"),
                pady=5,
                cursor="hand2"
            )
            btn_crear.pack(pady=5)
        
        return acordeon_frame
    
    def crear_archivos_cliente(self, error_item):
        """Crea los archivos faltantes para un cliente específico"""
        carpeta_cliente = error_item['carpeta']
        gestiones_esperadas = error_item.get('gestiones_esperadas', [])
        archivos_faltantes = error_item.get('archivos_faltantes', [])
        
        # Buscar carpeta del cliente
        carpetas = [d for d in os.listdir(self.carpeta_salida_path) 
                    if os.path.isdir(os.path.join(self.carpeta_salida_path, d)) and "evidencias" in d]
        
        if not carpetas:
            messagebox.showerror("Error", "No se encontraron carpetas de evidencias")
            return
        
        carpeta_evidencias = os.path.join(self.carpeta_salida_path, carpetas[-1])
        carpeta_cliente_path = os.path.join(carpeta_evidencias, carpeta_cliente)
        
        if not os.path.exists(carpeta_cliente_path):
            messagebox.showerror("Error", f"No se encontró la carpeta: {carpeta_cliente_path}")
            return
        
        # Extraer cuenta del nombre de carpeta
        partes = carpeta_cliente.rsplit("_", 1)
        cuenta_cliente = partes[-1] if len(partes) > 1 else ""
        
        # Buscar cliente en datos_fuente
        if self.datos_fuente_df is None:
            messagebox.showerror("Error", "Debe cargar datos_fuente.xlsx primero")
            return
        
        cliente_row = None
        cuenta_col = None
        nombre_col = None
        
        for col in self.datos_fuente_df.columns:
            if "CUENTA" in str(col).upper():
                cuenta_col = col
            if "NOMBRE" in str(col).upper() or "CLIENTE" in str(col).upper():
                nombre_col = col
        
        if cuenta_col:
            matches = self.datos_fuente_df[
                self.datos_fuente_df[cuenta_col].astype(str).str.strip() == cuenta_cliente
            ]
            if len(matches) > 0:
                cliente_row = matches.iloc[0]
        
        if cliente_row is None:
            messagebox.showerror("Error", f"No se encontró el cliente con cuenta {cuenta_cliente}")
            return
        
        nombre_cliente = str(cliente_row.get(nombre_col or "NOMBRE", carpeta_cliente.split("_")[0])).strip()
        
        # Crear archivos faltantes
        creados = 0
        for gestion in gestiones_esperadas:
            if gestion == "IVR" and "IVR" in " ".join(archivos_faltantes):
                try:
                    self.procesar_ivr(cliente_row, carpeta_cliente_path, nombre_cliente)
                    creados += 1
                except Exception as e:
                    self.log(f"❌ Error creando IVR para {carpeta_cliente}: {str(e)}")
            
            elif gestion == "SMS" and "SMS" in " ".join(archivos_faltantes):
                try:
                    self.procesar_sms(cliente_row, carpeta_cliente_path, nombre_cliente)
                    creados += 1
                except Exception as e:
                    self.log(f"❌ Error creando SMS para {carpeta_cliente}: {str(e)}")
            
            elif gestion == "CALL" and "CALL" in " ".join(archivos_faltantes):
                try:
                    self.procesar_call(cliente_row, carpeta_cliente_path, nombre_cliente, cuenta_cliente)
                    creados += 1
                except Exception as e:
                    self.log(f"❌ Error creando CALL para {carpeta_cliente}: {str(e)}")
        
        if creados > 0:
            messagebox.showinfo("Éxito", f"Se crearon {creados} archivo(s) para {carpeta_cliente}")
            self.ejecutar_auditor()  # Re-ejecutar auditoría
        else:
            messagebox.showwarning("Advertencia", "No se pudieron crear los archivos faltantes")
    
    def crear_archivos_faltantes(self, reporte, window_auditor):
        """Crea todos los archivos faltantes para todas las carpetas con errores"""
        respuesta = messagebox.askyesno(
            "Confirmar",
            f"¿Desea crear los archivos faltantes para {len(reporte['carpetas_error'])} carpeta(s)?"
        )
        
        if not respuesta:
            return
        
        self.log("🔧 Iniciando creación de archivos faltantes...")
        total_creados = 0
        
        for error_item in reporte['carpetas_error']:
            try:
                self.crear_archivos_cliente(error_item)
                total_creados += 1
            except Exception as e:
                self.log(f"❌ Error creando archivos para {error_item['carpeta']}: {str(e)}")
        
        self.log(f"✅ Creación completada: {total_creados} carpeta(s) procesada(s)")
        messagebox.showinfo("Éxito", f"Se procesaron {total_creados} carpeta(s)")
        
        # Re-ejecutar auditoría
        window_auditor.destroy()
        self.ejecutar_auditor()
    
    def exportar_reporte_html(self, reporte):
        """Exporta el reporte de auditoría en formato HTML"""
        file_path = filedialog.asksaveasfilename(
            defaultextension=".html",
            filetypes=[("HTML files", "*.html")]
        )
        
        if not file_path:
            return
        
        html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte de Auditoría - Evidencias</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; padding: 20px; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        .header {{ background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
        .header h1 {{ font-size: 28px; margin-bottom: 10px; }}
        .stats {{ display: flex; gap: 20px; margin: 20px 0; }}
        .stat-card {{ flex: 1; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }}
        .stat-card.total {{ border-top: 4px solid #3498db; }}
        .stat-card.ok {{ border-top: 4px solid #27ae60; }}
        .stat-card.error {{ border-top: 4px solid #e74c3c; }}
        .stat-number {{ font-size: 36px; font-weight: bold; margin: 10px 0; }}
        .error-section {{ margin-top: 30px; }}
        .acordeon {{ background: white; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }}
        .acordeon-header {{ background: #34495e; color: white; padding: 15px 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }}
        .acordeon-header:hover {{ background: #2c3e50; }}
        .acordeon-content {{ padding: 20px; display: none; }}
        .acordeon-content.active {{ display: block; }}
        .error-list {{ list-style: none; padding-left: 0; }}
        .error-list li {{ padding: 8px; margin: 5px 0; background: #fee; border-left: 3px solid #e74c3c; }}
        .success {{ background: #d4edda; color: #155724; padding: 20px; border-radius: 8px; text-align: center; font-size: 18px; margin-top: 30px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Reporte de Auditoría - Evidencias</h1>
            <p>Fecha: {datetime.now().strftime("%d/%m/%Y %H:%M:%S")}</p>
        </div>
        
        <div class="stats">
            <div class="stat-card total">
                <div class="stat-label">📁 Total Carpetas</div>
                <div class="stat-number">{reporte['total_carpetas']}</div>
            </div>
            <div class="stat-card ok">
                <div class="stat-label">✅ Correctas</div>
                <div class="stat-number">{reporte['carpetas_ok']}</div>
            </div>
            <div class="stat-card error">
                <div class="stat-label">❌ Con Errores</div>
                <div class="stat-number">{len(reporte['carpetas_error'])}</div>
            </div>
        </div>
"""
        
        if reporte['carpetas_error']:
            html += '<div class="error-section"><h2 style="margin-bottom: 20px;">📋 Detalle de Errores</h2>'
            
            for idx, error_item in enumerate(reporte['carpetas_error']):
                gestiones_str = ", ".join(error_item.get('gestiones_esperadas', []))
                html += f"""
                <div class="acordeon">
                    <div class="acordeon-header" onclick="toggleAcordeon({idx})">
                        <div>
                            <strong>📁 {error_item['carpeta']}</strong>
                            <div style="font-size: 12px; margin-top: 5px;">Gestiones: {gestiones_str} | Archivos: {error_item.get('archivos_encontrados', 0)}/{error_item.get('archivos_esperados', 0)}</div>
                        </div>
                        <span id="toggle-{idx}">▶</span>
                    </div>
                    <div class="acordeon-content" id="content-{idx}">
                        <h3>Detalles</h3>
                        <ul class="error-list">
"""
                for error in error_item['errores']:
                    html += f"<li>❌ {error}</li>"
                
                if error_item.get('archivos_faltantes'):
                    html += "<li><strong>Archivos faltantes:</strong> " + ", ".join(error_item['archivos_faltantes']) + "</li>"
                
                html += """
                        </ul>
                    </div>
                </div>
"""
            
            html += '</div>'
        else:
            html += '<div class="success">✅ Todas las carpetas están correctas</div>'
        
        html += """
    </div>
    <script>
        function toggleAcordeon(idx) {
            const content = document.getElementById('content-' + idx);
            const toggle = document.getElementById('toggle-' + idx);
            if (content.classList.contains('active')) {
                content.classList.remove('active');
                toggle.textContent = '▶';
            } else {
                content.classList.add('active');
                toggle.textContent = '▼';
            }
        }
    </script>
</body>
</html>
"""
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(html)
        
        messagebox.showinfo("Éxito", f"Reporte exportado a {file_path}")


if __name__ == "__main__":
    root = tk.Tk()
    app = EvidenciasApp(root)
    root.mainloop()

