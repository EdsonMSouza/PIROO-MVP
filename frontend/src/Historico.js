import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FileText, CheckCircle2, XCircle } from 'lucide-react';

function Historico() {
    const [registros, setRegistros] = useState([]);

    useEffect(() => {
        const buscarDados = async () => {
            const response = await axios.get('http://localhost:3001/api/historico');
            setRegistros(response.data);
        };
        buscarDados();
    }, []);

    return (
        <div className="Historico">
            <header className="app-header">
                <FileText size={32} />
                <h1>Painel de Auditoria - PIROO</h1>
            </header>

            <div className="tabela-container">
                <table>
                    <thead>
                        <tr>
                            <th>Data/Hora</th>
                            <th>Placa</th>
                            <th>Transportador</th>
                            <th>Análise IA</th>
                        </tr>
                    </thead>
                    <tbody>
                        {registros.map((reg, index) => (
                            <tr key={index}>
                                <td>{new Date(reg.data).toLocaleString()}</td>
                                <td><strong>{reg.placa}</strong></td>
                                <td>{reg.transportador}</td>
                                <td className="ia-col">
                                    {reg.analiseIA.includes("Conforme") ? 
                                        <CheckCircle2 color="green" size={18} /> : 
                                        <XCircle color="red" size={18} />
                                    }
                                    <span>{reg.analiseIA}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button className="btn-reset" onClick={() => window.location.reload()}>Atualizar Painel</button>
        </div>
    );
}

export default Historico;