# KubernetesSubmissions

## Exercises

### Chapter 1

- [1.1.](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/1.1)

![1.1](./sample/1.1.png)

- [1.2.](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/1.2)

![1.2](./sample/1.2.png)

- [1.3.](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/1.3)

- [1.4.](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/1.4)

- [1.5.](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/1.5)

  ![1.5.1.](./sample/1.5.1.png)
  ![1.5.2.](./sample/1.5.2.png)

- [1.6](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/1.6)

  ![1.6](./sample/1.6.png)

- [1.7](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/1.7)

  ![1.7](./sample/1.7.png)

- [1.8](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/1.8)

- [1.9](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/1.9)

  ![1.9](./sample/1.9.png)

- [1.10](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/1.10)

  ![1.10.1](./sample/1.10.1.png)
  ![1.10.2](./sample/1.10.2.png)

- [1.11](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/1.11)
  ![1.11.1](./sample/1.11.1.png)

  ![1.11.2](./sample/1.11.2.png)

- [1.12](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/1.12)

  ![1.12](./sample/1.12.png)

- [1.13](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/1.13)

  ![1.13](./sample/1.13.png)

- [2.1](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/2.1)

  ![2.1.1](./sample/2.1.1.png)
  ![2.1.2](./sample/2.1.2.png)
  ![2.1.3](./sample/2.1.3.png)

- [2.2](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/2.2)
  ![2.2.1](./sample/2.2.1.png)
  ![2.2.2](./sample/2.2.2.png)

- [2.3](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/2.3)
  ![2.3.1](./sample/2.3.1.png)
  ![2.3.2](./sample/2.3.2.png)

- [2.4](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/2.4)
  ![2.4.1](./sample/2.4.1.png)
  ![2.4.2](./sample/2.4.2.png)

- [2.5](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/2.5)
  ![2.5](./sample/2.5.png)

- [2.6](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/2.6)
  ![2.6](./sample/2.6.png)

- [2.7](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/2.7)
  ![2.7](./sample/2.7.png)

- [2.8](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/2.8)
  ![2.8.1](./sample/2.8.1.png)
  ![2.8.2](./sample/2.8.2.png)

- [2.9](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/2.9)
  ![2.9](./sample/2.9.png)

- [2.10](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/2.10)
  ![2.10](./sample/2.10.png)

- [3.1](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/3.1)

  ![3.1](./sample/3.1.png)

- [3.2](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/3.2)

  ![3.2.1](./sample/3.2.1.png)
  ![3.2.2](./sample/3.2.2.png)
  ![3.2.2](./sample/3.2.3.png)

- [3.3](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/3.3)

  ![3.3.1](./sample/3.3.1.png)
  ![3.3.2](./sample/3.3.2.png)
  ![3.3.2](./sample/3.3.3.png)

- [3.4](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/3.4)

  ![3.4](./sample/3.4.png)

- [3.5](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/3.5)

  ![3.5](./sample/3.5.png)

- [3.6](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/3.6)

  ![3.6](./sample/3.6.png)

- [3.7](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/3.7)

- [3.8](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/3.8)

- [3.9](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/3.9)

## DBaaS (Cloud SQL) vs DIY PostgreSQL on GKE (PVC)

### 1. Initialization & Setup

**DBaaS (Google Cloud SQL)**

- ✅ Fast to initialize (minutes via UI / CLI / Terraform)
- ✅ No need to manage storage, replication, or failover
- ❌ Requires networking setup (private IP, Cloud SQL Proxy / connector)

**DIY (PostgreSQL on GKE with PVCs)**

- ❌ More setup work (StatefulSets, PVCs, StorageClasses)
- ❌ High availability and failover must be designed manually
- ✅ Full control over database configuration and deployment

---

### 2. Maintenance & Operations

**DBaaS**

- ✅ Automatic updates, patching, and security fixes
- ✅ Managed high availability and failover
- ❌ Limited control over internal PostgreSQL configuration
- ❌ Vendor lock-in to Google Cloud

**DIY**

- ❌ Manual upgrades, monitoring, and failure recovery
- ❌ Requires strong Kubernetes and database expertise
- ✅ Full control over PostgreSQL version and tuning
- ✅ Easier portability across environments

---

### 3. Backups & Recovery

**DBaaS**

- ✅ Automated daily backups
- ✅ Point-in-time recovery supported
- ✅ Simple restore via UI or CLI
- ❌ Limited customization of backup strategy

**DIY**

- ❌ Backups must be implemented manually (pg_dump, cronjobs, operators)
- ❌ Restore process is more complex and error-prone
- ✅ Full control over backup format, schedule, and storage location

---

### 4. Scalability & Reliability

**DBaaS**

- ✅ Easy vertical scaling (CPU / RAM)
- ✅ Built-in replication and high availability
- ❌ Limited horizontal scaling (read replicas only)

**DIY**

- ❌ Scaling and HA require additional tooling (operators, Patroni)
- ❌ Greater risk of misconfiguration
- ✅ Flexible for advanced or custom architectures

---

### 5. Costs

**DBaaS**

- ❌ Higher service cost due to managed features
- ❌ Pay for HA, backups, and availability even when underutilized
- ✅ Lower operational cost (less maintenance effort)

**DIY**

- ✅ Potentially lower infrastructure cost
- ❌ Higher operational and engineering effort
- ❌ Risk of downtime increases indirect costs

---

### 6. When to Choose Which

**Choose DBaaS when:**

- Reliability and data safety are top priorities
- Operational effort must be minimized
- Database expertise is limited

**Choose DIY when:**

- Full control and portability are required
- You want to learn or customize PostgreSQL deeply
- Cost optimization is critical and team expertise is sufficient

---

### Conclusion

DBaaS favors **simplicity, reliability, and low operational overhead** at a higher service cost, while DIY PostgreSQL on GKE offers **greater control and flexibility** but requires **significantly more maintenance and operational expertise**.

- [3.10](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/3.10)
  ![3.10.1](./sample/3.10.1.png)
  ![3.10.2](./sample/3.10.2.png)

- [3.11](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/3.11)
  ![3.11](./sample/3.11.png)

- [3.12](https://github.com/VienThanh12/DevOps-with-Kubernetes/tree/3.12)
  ![3.12.1](./sample/3.12.1.png)
  ![3.12.2](./sample/3.12.2.png)
