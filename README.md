# K8s 学习沙盒

本地 Kubernetes 学习环境，基于 OrbStack 单节点集群。

## 环境状态

- **集群**: OrbStack (v1.33.9+orb1)
- **Ingress Controller**: nginx (已安装)
- **Dashboard**: v2.7.0 (已安装)
- **镜像加速**: 已配置国内 mirror + 7890 代理

## 快速访问

```bash
# Dashboard（浏览器打开）
https://localhost:8443

# 登录 Token（复制粘贴）
kubectl -n kubernetes-dashboard create token admin-user

# Demo 应用（三种访问方式）
curl -H "Host: demo.local" http://localhost/     # Ingress
curl http://localhost:30080/                      # NodePort
kubectl port-forward svc/demo 8081:8080           # ClusterIP + port-forward
curl http://localhost:8081/
```

## 学习文件清单

| 文件 | 内容 | 学习要点 |
|------|------|----------|
| `01-pod.yaml` | 基础 Pod | 探针、资源限制、port-forward |
| `02-deployment.yaml` | Deployment | 滚动更新、回滚、副本管理 |
| `03-service.yaml` | Service | ClusterIP/NodePort/LoadBalancer、DNS |
| `04-configmap-secret.yaml` | 配置管理 | 环境变量注入、文件挂载、热更新 |
| `05-ingress.yaml` | Ingress | 七层路由、域名、路径匹配 |
| `06-job-cronjob.yaml` | 任务调度 | 一次性任务、定时任务、cron 表达式 |
| `07-pvc.yaml` | 持久化存储 | PV/PVC、hostPath、数据持久性 |

## 推荐学习顺序

1. **Pod** → 最小单元，理解容器编排基础
2. **Deployment** → 无状态应用标准控制器，重点练滚动更新/回滚
3. **Service** → 稳定访问入口，理解 DNS 和负载均衡
4. **ConfigMap/Secret** → 配置与敏感数据分离
5. **Ingress** → 七层路由，理解域名和路径匹配
6. **Job/CronJob** → 任务调度
7. **PVC** → 持久化存储

## 常用命令速查

```bash
# 查看资源
kubectl get pods,svc,deploy,ingress
kubectl describe pod <name>
kubectl logs <pod-name>
kubectl exec -it <pod-name> -- sh

# 部署/更新
kubectl apply -f <file.yaml>
kubectl delete -f <file.yaml>
kubectl set image deploy/demo demo=demo:v2    # 滚动更新
kubectl rollout status deploy/demo             # 查看状态
kubectl rollout undo deploy/demo               # 回滚

# 调试
kubectl port-forward pod/<name> 8080:8080
kubectl run curl-test --image=curlimages/curl -it --rm -- sh
kubectl explain pod.spec.containers            # 查字段含义

# 切换上下文/命名空间
kubectx                                        # 列出集群
kubens <namespace>                             # 切换命名空间
```

## 练习建议

### 练习1：滚动更新与回滚
```bash
# 1. 部署 v1
kubectl apply -f 02-deployment.yaml
kubectl get pods -w                              # 观察 Pod 变化

# 2. 更新到 v2
kubectl set image deploy/demo demo=demo:v2
kubectl rollout status deploy/demo
curl -H "Host: demo.local" http://localhost/     # 验证版本变化

# 3. 回滚
kubectl rollout undo deploy/demo
curl -H "Host: demo.local" http://localhost/     # 验证回到 v1
```

### 练习2：ConfigMap 热更新
```bash
# 1. 部署配置
kubectl apply -f 04-configmap-secret.yaml
kubectl exec config-demo -- cat /etc/demo/app.properties

# 2. 修改 ConfigMap
kubectl edit cm demo-config                      # 改 MESSAGE 字段

# 3. 验证（文件挂载方式会自动更新，环境变量方式需重启 Pod）
kubectl exec config-demo -- cat /etc/demo/app.properties
```

### 练习3：Ingress 多路径路由
```bash
# 编辑 05-ingress.yaml，添加多个 path 规则
# 例如：/api → api-service，/ → frontend-service
kubectl apply -f 05-ingress.yaml
kubectl describe ingress demo                    # 查看路由规则
```

## 清理环境

```bash
# 删除所有学习资源
kubectl delete -f 01-pod.yaml -f 02-deployment.yaml -f 03-service.yaml
kubectl delete -f 04-configmap-secret.yaml -f 05-ingress.yaml
kubectl delete -f 06-job-cronjob.yaml -f 07-pvc.yaml

# 卸载 Dashboard（可选）
kubectl delete -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml

# 卸载 ingress-nginx（可选）
kubectl delete -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.1/deploy/static/provider/cloud/deploy.yaml
```

## 故障排查

**镜像拉取失败**
```bash
# 检查镜像是否存在
docker images | grep <image-name>

# 检查网络（需要代理访问 Docker Hub）
curl -x http://127.0.0.1:7890 https://registry-1.docker.io/v2/
```

**Pod 一直 Pending**
```bash
kubectl describe pod <name>                      # 看 Events
kubectl get events --sort-by='.lastTimestamp'    # 查看集群事件
```

**Service 无法访问**
```bash
kubectl get endpoints <service-name>             # 检查是否有后端 Pod
kubectl logs <pod-name>                          # 检查应用日志
```

## 下一步学习

- **Helm**: 包管理工具，简化应用部署
- **Kustomize**: 配置复用和覆盖
- **监控**: Prometheus + Grafana
- **RBAC**: 权限控制
- **GitOps**: ArgoCD 自动化部署

## 参考资源

- [Kubernetes 官方文档](https://kubernetes.io/zh-cn/docs/)
- [Kubernetes 中文指南](https://k8s.coding.me/)
- [OrbStack 文档](https://docs.orbstack.dev/)
